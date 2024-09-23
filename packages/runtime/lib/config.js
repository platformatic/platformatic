'use strict'

const { readdir } = require('node:fs/promises')
const { join, resolve: pathResolve } = require('node:path')

const ConfigManager = require('@platformatic/config')

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
        services[existingServiceId] = service
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

    if (configManager._fixPaths && service.config) {
      service.config = pathResolve(service.path, service.config)
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

  if (!hasValidEntrypoint) {
    throw new errors.InvalidEntrypointError(config.entrypoint)
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
