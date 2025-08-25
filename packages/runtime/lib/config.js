'use strict'

const { readdir } = require('node:fs/promises')
const { createRequire } = require('node:module')
const { join, resolve: pathResolve, isAbsolute } = require('node:path')
const {
  loadModule,
  omitProperties,
  schemaComponents: { runtimeUnwrappablePropertiesList }
} = require('@platformatic/utils')
const ConfigManager = require('@platformatic/config')
const { Store } = require('@platformatic/config')

const errors = require('./errors')
const { schema } = require('./schema')
const upgrade = require('./upgrade')
const { parseArgs } = require('node:util')

function autoDetectPprofCapture (config) {
  // Check if package is installed
  try {
    let pprofCapturePath
    try {
      pprofCapturePath = require.resolve('@platformatic/watt-pprof-capture')
    } catch (err) {
      pprofCapturePath = require.resolve('../../watt-pprof-capture/index.js')
    }

    // Add to preload if not already present
    if (!config.preload) {
      config.preload = []
    } else if (typeof config.preload === 'string') {
      config.preload = [config.preload]
    }

    if (!config.preload.includes(pprofCapturePath)) {
      config.preload.push(pprofCapturePath)
    }
  } catch (err) {
    // Package not installed, skip silently
  }

  return config
}

async function _transformConfig (configManager, args) {
  const config = configManager.current

  const { values } = parseArgs({
    args,
    strict: false,
    options: { production: { type: 'boolean', short: 'p', default: false } }
  })
  const production = values.production

  let services
  if (config.web?.length) {
    if (config.services?.length) {
      throw new errors.InvalidServicesWithWebError()
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

    // This is a hack, but it's the only way to not fix the paths for the autoloaded services
    // while we are upgrading the config
    if (configManager._fixPaths) {
      path = pathResolve(configManager.dirname, path)
    }

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
      const configFilename = mapping.config ?? (await ConfigManager.findConfigFile(entryPath))

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

  configManager.current.serviceMap = new Map()
  configManager.current.inspectorOptions = undefined

  let hasValidEntrypoint = false

  // Validate and coerce workers values early to avoid runtime hangs when invalid
  function coercePositiveInteger (value) {
    if (typeof value === 'number') {
      if (!Number.isInteger(value) || value < 1) return null
      return value
    }
    if (typeof value === 'string') {
      // Trim to handle accidental spaces
      const trimmed = value.trim()
      if (trimmed.length === 0) return null
      const num = Number(trimmed)
      if (!Number.isFinite(num) || !Number.isInteger(num) || num < 1) return null
      return num
    }
    return null
  }

  function raiseInvalidWorkersError (location, received, hint) {
    const extra = hint ? ` (${hint})` : ''
    throw new errors.InvalidArgumentError(
      `${location} workers must be a positive integer; received "${received}"${extra}`
    )
  }

  // Root-level workers
  if (typeof config.workers !== 'undefined') {
    const coerced = coercePositiveInteger(config.workers)
    if (coerced === null) {
      const raw = configManager.currentRaw?.workers
      const hint = typeof raw === 'string' && /\{.*\}/.test(raw) ? 'check your environment variable' : ''
      raiseInvalidWorkersError('Runtime', config.workers, hint)
    }
    config.workers = coerced
  }

  for (let i = 0; i < services.length; ++i) {
    const service = services[i]

    // We need to have absolute paths here, ot the `loadConfig` will fail
    // Make sure we don't resolve if env var was not replaced
    if (service.path && !isAbsolute(service.path) && !service.path.match(/^\{.*\}$/)) {
      service.path = pathResolve(configManager.dirname, service.path)
    }

    if (configManager._fixPaths && service.path && service.config) {
      service.config = pathResolve(service.path, service.config)
    }

    if (service.config) {
      try {
        const store = new Store({ cwd: service.path })
        const serviceConfig = await store.loadConfig(service)
        service.isPLTService = !!serviceConfig.app.isPLTService
        service.type = serviceConfig.app.configType
        const _require = createRequire(service.path)
        // This is needed to work around Rust bug on dylibs:
        // https://github.com/rust-lang/rust/issues/91979
        // https://github.com/rollup/rollup/issues/5761
        // TODO(mcollina): we should expose this inside every stackable configuration.
        serviceConfig.app.modulesToLoad?.forEach(m => {
          const toLoad = _require.resolve(m)
          loadModule(_require, toLoad).catch(() => {})
        })
      } catch (err) {
        // Fallback if for any reason a dependency is not found
        try {
          const manager = new ConfigManager({ source: pathResolve(service.path, service.config) })
          await manager.parse()
          const config = manager.current
          const type = config.$schema ? ConfigManager.matchKnownSchema(config.$schema) : undefined
          service.type = type
          service.isPLTService = !!config.isPLTService
        } catch (err) {
          // This should not happen, it happens on running some unit tests if we prepare the runtime
          // when not all the services configs are available. Given that we are running this only
          // to ddetermine the type of the service, it's safe to ignore this error and default to unknown
          service.type = 'unknown'
          service.isPLTService = false
        }
      }
    } else {
      // We need to identify the service type
      const basic = await import('@platformatic/basic')
      service.isPLTService = false
      try {
        const { stackable } = await basic.importStackableAndConfig(service.path)
        service.type = stackable.default.configType
        const _require = createRequire(service.path)
        // This is needed to work around Rust bug on dylibs:
        // https://github.com/rust-lang/rust/issues/91979
        // https://github.com/rollup/rollup/issues/5761
        // TODO(mcollina): we should expose this inside every stackable configuration.
        stackable.default.modulesToLoad?.forEach(m => {
          const toLoad = _require.resolve(m)
          loadModule(_require, toLoad).catch(() => {})
        })
      } catch {
        // Nothing to do here
      }
    }

    // Validate and coerce per-service workers
    if (typeof service.workers !== 'undefined') {
      const coerced = coercePositiveInteger(service.workers)
      if (coerced === null) {
        const raw = configManager.currentRaw?.services?.[i]?.workers
        const hint = typeof raw === 'string' && /\{.*\}/.test(raw) ? 'check your environment variable' : ''
        raiseInvalidWorkersError(`Service "${service.id}"`, service.workers, hint)
      }
      service.workers = coerced
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

    configManager.current.serviceMap.set(service.id, service)
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

        if (service.type === 'composer') {
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

  if (!hasValidEntrypoint) {
    if (config.entrypoint) {
      throw new errors.InvalidEntrypointError(config.entrypoint)
    } else if (services.length >= 1) {
      throw new errors.MissingEntrypointError()
    }
    // If there are no services, and no entrypoint it's an empty app.
    // It won't start, but we should be able to parse and operate on it,
    // like adding other services.
  }

  configManager.current.services = services
  configManager.current.web = undefined

  if (production) {
    // Any value below 10 is considered as "immediate restart" and won't be processed via setTimeout or similar
    // Important: do not use 2 otherwise ajv will convert to boolean `true`
    configManager.current.restartOnError = 2
  } else {
    if (configManager.current.restartOnError === true) {
      configManager.current.restartOnError = 5000
    } else if (configManager.current.restartOnError < 0) {
      configManager.current.restartOnError = 0
    }
  }

  // Auto-detect and add pprof capture if available
  autoDetectPprofCapture(configManager.current)
}

async function platformaticRuntime () {
  // No-op. Here for consistency with other app types.
}

platformaticRuntime[Symbol.for('skip-override')] = true
platformaticRuntime.schema = schema
platformaticRuntime.configType = 'runtime'
platformaticRuntime.configManagerConfig = {
  version: require('../package.json').version,
  schema,
  allowToWatch: ['.env'],
  schemaOptions: {
    useDefaults: true,
    coerceTypes: true,
    allErrors: true,
    strict: false
  },
  async transformConfig (args) {
    await _transformConfig(this, args)
  },
  upgrade
}

async function wrapConfigInRuntimeConfig ({ configManager, args, opts }) {
  let serviceId = 'main'
  try {
    const packageJson = join(configManager.dirname, 'package.json')
    serviceId = require(packageJson).name || 'main'
    if (serviceId.startsWith('@')) {
      serviceId = serviceId.split('/')[1]
    }
  } catch (err) {
    // on purpose, the package.json might be missing
  }

  // If the service supports its (so far, only @platformatic/service and descendants)
  const { hostname, port, http2, https } = configManager.current.server ?? {}
  const server = { hostname, port, http2, https }

  // Important: do not change the order of the properties in this object
  /* c8 ignore next */
  const wrapperConfig = {
    $schema: schema.$id,
    server,
    watch: !args?.production,
    ...omitProperties(configManager.current.runtime ?? {}, runtimeUnwrappablePropertiesList),
    entrypoint: serviceId,
    services: [
      {
        id: serviceId,
        path: configManager.dirname,
        config: configManager.fullPath
      }
    ]
  }

  const cm = new ConfigManager({
    source: wrapperConfig,
    schema,
    schemaOptions: {
      useDefaults: true,
      coerceTypes: true,
      allErrors: true,
      strict: false
    },
    transformConfig (args) {
      return _transformConfig(this, args)
    }
  })

  await cm.parseAndValidate(true, [], opts)

  return cm
}

function parseInspectorOptions (configManager) {
  const { current, args } = configManager
  const hasInspect = 'inspect' in args
  const hasInspectBrk = 'inspect-brk' in args
  let inspectFlag

  if (hasInspect) {
    inspectFlag = args.inspect

    if (hasInspectBrk) {
      throw new errors.InspectAndInspectBrkError()
    }
  } else if (hasInspectBrk) {
    inspectFlag = args['inspect-brk']
  }

  if (inspectFlag !== undefined) {
    let host = '127.0.0.1'
    let port = 9229

    if (typeof inspectFlag === 'string' && inspectFlag.length > 0) {
      const splitAt = inspectFlag.lastIndexOf(':')

      if (splitAt === -1) {
        port = inspectFlag
      } else {
        host = inspectFlag.substring(0, splitAt)
        port = inspectFlag.substring(splitAt + 1)
      }

      port = Number.parseInt(port, 10)

      if (!(port === 0 || (port >= 1024 && port <= 65535))) {
        throw new errors.InspectorPortError()
      }

      if (!host) {
        throw new errors.InspectorHostError()
      }
    }

    current.inspectorOptions = {
      host,
      port,
      breakFirstLine: hasInspectBrk,
      watchDisabled: !!current.watch
    }

    current.watch = false
  }
}

module.exports = {
  parseInspectorOptions,
  platformaticRuntime,
  wrapConfigInRuntimeConfig,
  autoDetectPprofCapture
}
