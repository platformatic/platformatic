'use strict'

const { join, resolve: resolvePath, isAbsolute } = require('node:path')
const { readdir } = require('node:fs/promises')
const { createRequire } = require('node:module')
const { importCapabilityAndConfig, validationOptions } = require('@platformatic/basic')
const {
  kMetadata,
  omitProperties,
  loadModule,
  runtimeUnwrappablePropertiesList,
  findConfigurationFile,
  loadConfigurationModule,
  loadConfiguration,
  extractModuleFromSchemaUrl
} = require('@platformatic/foundation')
const {
  InspectAndInspectBrkError,
  InvalidEntrypointError,
  MissingEntrypointError,
  InspectorPortError,
  InspectorHostError
} = require('./errors')
const { schema } = require('./schema')
const { upgrade } = require('./upgrade')

async function wrapInRuntimeConfig (config, context) {
  let applicationId = 'main'
  try {
    const packageJson = join(config[kMetadata].root, 'package.json')
    applicationId = require(packageJson).name || 'main'

    if (applicationId.startsWith('@')) {
      applicationId = applicationId.split('/')[1]
    }
  } catch (err) {
    // on purpose, the package.json might be missing
  }

  // If the application supports its (so far, only @platformatic/service and descendants)
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
    entrypoint: applicationId,
    applications: [
      {
        id: applicationId,
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
  const applications = [...(config.applications ?? []), ...(config.services ?? []), ...(config.web ?? [])]

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

      const application = { id, config, path: entryPath, useHttp: !!mapping.useHttp, health: mapping.health }
      const existingApplicationId = applications.findIndex(application => application.id === id)

      if (existingApplicationId !== -1) {
        applications[existingApplicationId] = { ...application, ...applications[existingApplicationId] }
      } else {
        applications.push(application)
      }
    }
  }

  config.inspectorOptions = undefined
  parseInspectorOptions(config, context?.inspect, context?.inspectBreak)

  let hasValidEntrypoint = false

  for (let i = 0; i < applications.length; ++i) {
    const application = applications[i]

    // We need to have absolute paths here, ot the `loadConfig` will fail
    // Make sure we don't resolve if env var was not replaced
    if (application.path && !isAbsolute(application.path) && !application.path.match(/^\{.*\}$/)) {
      application.path = resolvePath(config[kMetadata].root, application.path)
    }

    if (application.path && application.config) {
      application.config = resolvePath(application.path, application.config)
    }

    try {
      let pkg

      if (application.config) {
        const config = await loadConfiguration(application.config)
        pkg = await loadConfigurationModule(application.path, config)

        application.type = extractModuleFromSchemaUrl(config, true).module
        application.skipTelemetryHooks = pkg.skipTelemetryHooks
      } else {
        const { moduleName, capability } = await importCapabilityAndConfig(application.path)
        pkg = capability

        application.type = moduleName
      }

      application.skipTelemetryHooks = pkg.skipTelemetryHooks

      // This is needed to work around Rust bug on dylibs:
      // https://github.com/rust-lang/rust/issues/91979
      // https://github.com/rollup/rollup/issues/5761
      const _require = createRequire(application.path)
      for (const m of pkg.modulesToLoad ?? []) {
        const toLoad = _require.resolve(m)
        loadModule(_require, toLoad).catch(() => {})
      }
    } catch (err) {
      // This should not happen, it happens on running some unit tests if we prepare the runtime
      // when not all the applications configs are available. Given that we are running this only
      // to ddetermine the type of the application, it's safe to ignore this error and default to unknown
      application.type = 'unknown'
    }

    application.entrypoint = application.id === config.entrypoint
    application.dependencies = []
    application.localUrl = `http://${application.id}.plt.local`

    if (typeof application.watch === 'undefined') {
      application.watch = config.watch
    }

    if (application.entrypoint) {
      hasValidEntrypoint = true
    }
  }

  // If there is no entrypoint, autodetect one
  if (!config.entrypoint) {
    // If there is only one application, it becomes the entrypoint
    if (applications.length === 1) {
      applications[0].entrypoint = true
      config.entrypoint = applications[0].id
      hasValidEntrypoint = true
    } else {
      // Search if exactly application uses @platformatic/composer
      const composers = []

      for (const application of applications) {
        if (!application.config) {
          continue
        }

        if (application.type === '@platformatic/composer') {
          composers.push(application.id)
        }
      }

      if (composers.length === 1) {
        applications.find(s => s.id === composers[0]).entrypoint = true
        config.entrypoint = composers[0]
        hasValidEntrypoint = true
      }
    }
  }

  if (!hasValidEntrypoint && !context.allowMissingEntrypoint) {
    if (config.entrypoint) {
      throw new InvalidEntrypointError(config.entrypoint)
    } else if (applications.length >= 1) {
      throw new MissingEntrypointError()
    }
    // If there are no applications, and no entrypoint it's an empty app.
    // It won't start, but we should be able to parse and operate on it,
    // like adding other applications.
  }

  config.applications = applications
  config.web = undefined
  config.services = undefined
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
