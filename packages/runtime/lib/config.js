'use strict'

const { join, resolve: resolvePath, isAbsolute } = require('node:path')
const { readdir } = require('node:fs/promises')
const { createRequire } = require('node:module')
const { importStackableAndConfig, validationOptions } = require('@platformatic/basic')
const {
  kMetadata,
  omitProperties,
  loadModule,
  runtimeUnwrappablePropertiesList,
  findConfigurationFile,
  loadConfigurationModule,
  loadConfiguration,
  extractModuleFromSchemaUrl
} = require('@platformatic/utils')
const {
  InspectAndInspectBrkError,
  InvalidEntrypointError,
  InvalidServicesWithWebError,
  MissingEntrypointError,
  InspectorPortError,
  InspectorHostError
} = require('./errors')
const { schema } = require('./schema')
const { upgrade } = require('./upgrade')

async function wrapInRuntimeConfig (config, context) {
  let serviceId = 'main'
  try {
    const packageJson = join(config[kMetadata].root, 'package.json')
    serviceId = require(packageJson).name || 'main'

    if (serviceId.startsWith('@')) {
      serviceId = serviceId.split('/')[1]
    }
  } catch (err) {
    // on purpose, the package.json might be missing
  }

  // If the service supports its (so far, only @platformatic/service and descendants)
  const { hostname, port, http2, https } = config.server ?? {}
  const server = { hostname, port, http2, https }
  const production = context?.isProduction ?? context?.production

  // Important: do not change the order of the properties in this object
  /* c8 ignore next */
  const wrapped = {
    $schema: schema.$id,
    server,
    watch: !production,
    ...omitProperties(config.runtime ?? {}, runtimeUnwrappablePropertiesList),
    entrypoint: serviceId,
    services: [
      {
        id: serviceId,
        path: config[kMetadata].root,
        config: config[kMetadata].path
      }
    ]
  }

  return loadConfiguration(wrapped, context?.schema ?? schema, {
    validationOptions,
    transform,
    upgrade,
    replaceEnv: true,
    root: config[kMetadata].root,
    ...context
  })
}

function parseInspectorOptions (config, inspect, inspectBreak) {
  const hasInspect = inspect != null
  const hasInspectBrk = inspectBreak != null

  if (hasInspect && hasInspectBrk) {
    throw new InspectAndInspectBrkError()
  }

  const value = inspectBreak ?? inspect

  if (!value) {
    return
  }

  let host = '127.0.0.1'
  let port = 9229

  if (typeof value === 'string' && value.length > 0) {
    const splitAt = value.lastIndexOf(':')

    if (splitAt === -1) {
      port = value
    } else {
      host = value.substring(0, splitAt)
      port = value.substring(splitAt + 1)
    }

    port = Number.parseInt(port, 10)

    if (!(port === 0 || (port >= 1024 && port <= 65535))) {
      throw new InspectorPortError()
    }

    if (!host) {
      throw new InspectorHostError()
    }
  }

  config.inspectorOptions = { host, port, breakFirstLine: hasInspectBrk, watchDisabled: !!config.watch }
  config.watch = false
}

async function transform (config, _, context) {
  const production = context?.isProduction ?? context?.production

  let services
  if (config.web?.length) {
    if (config.services?.length) {
      throw new InvalidServicesWithWebError()
    }

    services = config.web
  } else {
    services = config.services ?? []
  }

  const watchType = typeof config.watch
  if (watchType === 'string') {
    config.watch = config.watch === 'true'
  } else if (watchType === 'undefined') {
    config.watch = !production
  }

  if (config.autoload) {
    const { exclude = [], mappings = {} } = config.autoload
    let { path } = config.autoload

    path = resolvePath(config[kMetadata].root, path)
    const entries = await readdir(path, { withFileTypes: true })

    for (let i = 0; i < entries.length; ++i) {
      const entry = entries[i]

      if (exclude.includes(entry.name) || !entry.isDirectory()) {
        continue
      }

      const mapping = mappings[entry.name] ?? {}
      const id = mapping.id ?? entry.name
      const entryPath = join(path, entry.name)

      let config
      const configFilename = mapping.config ?? (await findConfigurationFile(entryPath))

      if (typeof configFilename === 'string') {
        config = join(entryPath, configFilename)
      }

      const service = { id, config, path: entryPath, useHttp: !!mapping.useHttp, health: mapping.health }
      const existingServiceId = services.findIndex(service => service.id === id)

      if (existingServiceId !== -1) {
        services[existingServiceId] = { ...service, ...services[existingServiceId] }
      } else {
        services.push(service)
      }
    }
  }

  config.serviceMap = new Map()
  config.inspectorOptions = undefined
  parseInspectorOptions(config, context?.inspect, context?.inspectBreak)

  let hasValidEntrypoint = false

  for (let i = 0; i < services.length; ++i) {
    const service = services[i]

    // We need to have absolute paths here, ot the `loadConfig` will fail
    // Make sure we don't resolve if env var was not replaced
    if (service.path && !isAbsolute(service.path) && !service.path.match(/^\{.*\}$/)) {
      service.path = resolvePath(config[kMetadata].root, service.path)
    }

    if (service.path && service.config) {
      service.config = resolvePath(service.path, service.config)
    }

    try {
      let pkg

      if (service.config) {
        const config = await loadConfiguration(service.config)
        pkg = await loadConfigurationModule(service.path, config)

        service.type = extractModuleFromSchemaUrl(config, true).module
        service.skipTelemetryHooks = pkg.skipTelemetryHooks
      } else {
        const { moduleName, stackable } = await importStackableAndConfig(service.path)
        pkg = stackable

        service.type = moduleName
      }

      service.skipTelemetryHooks = pkg.skipTelemetryHooks

      // This is needed to work around Rust bug on dylibs:
      // https://github.com/rust-lang/rust/issues/91979
      // https://github.com/rollup/rollup/issues/5761
      const _require = createRequire(service.path)
      for (const m of pkg.modulesToLoad ?? []) {
        const toLoad = _require.resolve(m)
        loadModule(_require, toLoad).catch(() => {})
      }
    } catch (err) {
      // This should not happen, it happens on running some unit tests if we prepare the runtime
      // when not all the services configs are available. Given that we are running this only
      // to ddetermine the type of the service, it's safe to ignore this error and default to unknown
      service.type = 'unknown'
    }

    service.entrypoint = service.id === config.entrypoint
    service.dependencies = []
    service.localServiceEnvVars = new Map()
    service.localUrl = `http://${service.id}.plt.local`

    if (typeof service.watch === 'undefined') {
      service.watch = config.watch
    }

    if (service.entrypoint) {
      hasValidEntrypoint = true
    }

    config.serviceMap.set(service.id, service)
  }

  // If there is no entrypoint, autodetect one
  if (!config.entrypoint) {
    // If there is only one service, it becomes the entrypoint
    if (services.length === 1) {
      services[0].entrypoint = true
      config.entrypoint = services[0].id
      hasValidEntrypoint = true
    } else {
      // Search if exactly service uses @platformatic/composer
      const composers = []

      for (const service of services) {
        if (!service.config) {
          continue
        }

        if (service.type === '@platformatic/composer') {
          composers.push(service.id)
        }
      }

      if (composers.length === 1) {
        services.find(s => s.id === composers[0]).entrypoint = true
        config.entrypoint = composers[0]
        hasValidEntrypoint = true
      }
    }
  }

  if (!hasValidEntrypoint && !context.allowMissingEntrypoint) {
    if (config.entrypoint) {
      throw new InvalidEntrypointError(config.entrypoint)
    } else if (services.length >= 1) {
      throw new MissingEntrypointError()
    }
    // If there are no services, and no entrypoint it's an empty app.
    // It won't start, but we should be able to parse and operate on it,
    // like adding other services.
  }

  config.services = services
  config.web = undefined
  config.logger ??= {}

  if (production) {
    // Any value below 10 is considered as "immediate restart" and won't be processed via setTimeout or similar
    // Important: do not use 2 otherwise ajv will convert to boolean `true`
    config.restartOnError = 2
  } else {
    if (config.restartOnError === true) {
      config.restartOnError = 5000
    } else if (config.restartOnError < 0) {
      config.restartOnError = 0
    }
  }

  return config
}

module.exports = {
  wrapInRuntimeConfig,
  parseInspectorOptions,
  transform
}
