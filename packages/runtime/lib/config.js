'use strict'

const { readdir } = require('node:fs/promises')
const { join, resolve: pathResolve, isAbsolute } = require('node:path')

const ConfigManager = require('@platformatic/config')
const { Store } = require('@platformatic/config')

const errors = require('./errors')
const { schema } = require('./schema')
const upgrade = require('./upgrade')
const { parseArgs } = require('node:util')

async function _transformConfig (configManager, args) {
  const config = configManager.current

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
    const { values } = parseArgs({
      args,
      strict: false,
      options: { production: { type: 'boolean', short: 'p', default: false } }
    })

    config.watch = !values.production
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

      const service = { id, config, path: entryPath, useHttp: !!mapping.useHttp }
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

  for (let i = 0; i < services.length; ++i) {
    const service = services[i]

    // We need to have absolut paths here, ot the `loadConfig` will fail
    if (!isAbsolute(service.path)) {
      service.path = pathResolve(configManager.dirname, service.path)
    }

    if (configManager._fixPaths && service.config) {
      service.config = pathResolve(service.path, service.config)
    }

    if (service.config) {
      try {
        const store = new Store({ cwd: service.path })
        const serviceConfig = await store.loadConfig(service)
        service.isPLTService = !!serviceConfig.app.isPLTService
        service.type = serviceConfig.app.configType
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

  if (configManager.current.restartOnError === true) {
    configManager.current.restartOnError = 5000
  }
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

async function wrapConfigInRuntimeConfig ({ configManager, args }) {
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

  /* c8 ignore next */
  const wrapperConfig = {
    $schema: schema.$id,
    entrypoint: serviceId,
    watch: true,
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

  await cm.parseAndValidate()
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
  wrapConfigInRuntimeConfig
}
