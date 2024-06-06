'use strict'
const { readFile, readdir } = require('node:fs/promises')
const { join, resolve: pathResolve } = require('node:path')
const { closest } = require('fastest-levenshtein')
const Topo = require('@hapi/topo')
const ConfigManager = require('@platformatic/config')
const { schema } = require('./schema')
const errors = require('./errors')
const upgrade = require('./upgrade')

async function _transformConfig (configManager) {
  const config = configManager.current
  const services = config.services ?? []

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
      const configFilename = mapping.config ?? await ConfigManager.findConfigFile(entryPath)

      if (typeof configFilename !== 'string') {
        throw new errors.NoConfigFileFoundError(id)
      }

      const config = join(entryPath, configFilename)

      const service = { id, config, path: entryPath, useHttp: !!mapping.useHttp }
      const existingServiceId = services.findIndex(service => service.id === id)

      if (existingServiceId !== -1) {
        services[existingServiceId] = service
      } else {
        services.push(service)
      }
    }
  }

  configManager.current.allowCycles = !!configManager.current.allowCycles

  configManager.current.serviceMap = new Map()
  configManager.current.inspectorOptions = undefined

  let hasValidEntrypoint = false

  for (let i = 0; i < services.length; ++i) {
    const service = services[i]

    if (configManager._fixPaths) {
      service.config = pathResolve(service.path, service.config)
    }
    service.entrypoint = service.id === config.entrypoint
    service.hotReload = !!config.hotReload
    service.dependencies = []
    service.dependents = []
    service.localServiceEnvVars = new Map()
    service.localUrl = `http://${service.id}.plt.local`

    if (service.entrypoint) {
      hasValidEntrypoint = true
    }

    configManager.current.serviceMap.set(service.id, service)
  }

  if (!hasValidEntrypoint) {
    throw new errors.InvalidEntrypointError(config.entrypoint)
  }

  configManager.current.services = services

  await parseClientsAndComposer(configManager)

  if (!configManager.current.allowCycles) {
    topologicalSort(configManager)
  }
}

function missingDependencyErrorMessage (clientName, service, configManager) {
  const closestName = closest(clientName, [...configManager.current.serviceMap.keys()])
  let errorMsg = `service '${service.id}' has unknown dependency: '${clientName}'.`
  if (closestName) {
    errorMsg += ` Did you mean '${closestName}'?`
  }
  return errorMsg
}

async function parseClientsAndComposer (configManager) {
  for (const service of configManager.current.services) {
    const cm = new ConfigManager({ source: service.config })
    const configString = await cm.load()
    const serviceConfig = cm._parser(configString)

    async function parseConfigUrl (urlString) {
      if (!urlString) {
        return { url: null, envVar: null }
      }

      try {
        const url = await cm.replaceEnv(urlString)
        return { url, envVar: null }
      } catch (err) {
        // The MissingValueError is an error coming from pupa
        // https://github.com/sindresorhus/pupa#missingvalueerror
        // All other errors are simply re-thrown.
        if (err.name !== 'MissingValueError' || urlString !== `{${err.key}}`) {
          throw err
        }
        return { url: null, envVar: err.key }
      }
    }

    async function addServiceDependency (service, dependencyId, urlString) {
      let { url, envVar } = await parseConfigUrl(urlString)
      if (url !== null) {
        service.dependencies.push({ id: dependencyId, url, local: false })
        return
      }

      const depService = configManager.current.serviceMap.get(dependencyId)
      if (depService === undefined) {
        throw new errors.MissingDependencyError(
          missingDependencyErrorMessage(dependencyId, service, configManager)
        )
      }

      url = `http://${dependencyId}.plt.local`

      if (envVar !== null) {
        service.localServiceEnvVars.set(envVar, url)
      }

      depService.dependents.push(service.id)
      service.dependencies.push({ id: dependencyId, url, local: true })
    }

    const composedServices = serviceConfig.composer?.services
    if (Array.isArray(composedServices)) {
      await Promise.all(
        composedServices.map(async (composedService) =>
          addServiceDependency(
            service,
            composedService.id,
            composedService.origin
          )
        )
      )
    }

    if (Array.isArray(serviceConfig.clients)) {
      await Promise.all(
        serviceConfig.clients.map(async (client) => {
          let clientServiceId = client.serviceId
          if (!clientServiceId) {
            try {
              const clientPath = pathResolve(service.path, client.path)
              const clientPackageJsonPath = join(clientPath, 'package.json')
              const clientPackageJSONFile = await readFile(clientPackageJsonPath, 'utf8')
              const clientPackageJSON = JSON.parse(clientPackageJSONFile)
              clientServiceId = clientPackageJSON.name ?? ''
            } catch (err) {
              if (client.url === undefined || client.name === undefined) {
                throw err
              }
            }
          }
          await addServiceDependency(service, clientServiceId, client.url)
        })
      )
    }
  }
}

function topologicalSort (configManager) {
  const { services } = configManager.current
  const topo = new Topo.Sorter()

  for (const service of services) {
    const localDependencyIds = service.dependencies
      .filter(dep => dep.local)
      .map(dep => dep.id)

    topo.add(service, {
      group: service.id,
      after: localDependencyIds,
      manual: true
    })
  }

  configManager.current.services = topo.sort()
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
  async transformConfig () {
    await _transformConfig(this)
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
    allowCycles: false,
    hotReload: true,
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
    transformConfig () { return _transformConfig(this) }
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
      hotReloadDisabled: !!current.hotReload
    }

    current.hotReload = false
  }
}

module.exports = {
  parseInspectorOptions,
  platformaticRuntime,
  wrapConfigInRuntimeConfig
}
