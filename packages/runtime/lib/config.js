'use strict'
const { readFile, readdir } = require('node:fs/promises')
const { basename, join, resolve: pathResolve } = require('node:path')
const Topo = require('@hapi/topo')
const ConfigManager = require('@platformatic/config')
const { schema } = require('./schema')

async function _transformConfig (configManager) {
  const config = configManager.current
  const services = config.services ?? []

  if (config.autoload) {
    const { path, exclude = [], mappings = {} } = config.autoload
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
        throw new Error(`no config file found for service '${id}'`)
      }

      const config = join(entryPath, configFilename)

      services.push({ id, config, path: entryPath })
    }
  }

  configManager.current.allowCycles = !!configManager.current.allowCycles
  configManager.current.serviceMap = new Map()

  let hasValidEntrypoint = false

  for (let i = 0; i < services.length; ++i) {
    const service = services[i]

    service.config = pathResolve(service.path, service.config)
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
    throw new Error(`invalid entrypoint: '${config.entrypoint}' does not exist`)
  }

  configManager.current.services = services
  await parseClientsAndComposer(configManager)

  if (!configManager.current.allowCycles) {
    topologicalSort(configManager)
  }
}

async function parseClientsAndComposer (configManager) {
  for (let i = 0; i < configManager.current.services.length; ++i) {
    const service = configManager.current.services[i]
    const cm = new ConfigManager({ source: service.config })
    const configString = await cm.load()
    const parsed = cm._parser(configString)

    if (Array.isArray(parsed.composer?.services)) {
      for (let i = 0; i < parsed.composer.services.length; ++i) {
        const dep = parsed.composer.services[i]
        /* c8 ignore next 4 - why c8? */
        const clientName = dep.id ?? ''
        const dependency = configManager.current.serviceMap.get(clientName)

        if (dependency === undefined) {
          /* c8 ignore next 2 */
          throw new Error(`service '${service.id}' has unknown dependency: '${clientName}'`)
        }

        dependency.dependents.push(service.id)

        if (dep.origin) {
          try {
            await cm.replaceEnv(dep.origin)
            /* c8 ignore next 4 */
          } catch (err) {
            if (err.name !== 'MissingValueError') {
              throw err
            }

            if (dep.origin === `{${err.key}}`) {
              service.localServiceEnvVars.set(err.key, `http://${clientName}.plt.local`)
            }
          }
        }

        service.dependencies.push({
          id: clientName,
          url: `http://${clientName}.plt.local`,
          local: true
        })
      }
    }

    if (Array.isArray(parsed.clients)) {
      const promises = parsed.clients.map((client) => {
        // eslint-disable-next-line no-async-promise-executor
        return new Promise(async (resolve, reject) => {
          let clientName = client.serviceId ?? ''
          let clientUrl
          let missingKey

          try {
            clientUrl = await cm.replaceEnv(client.url)
            /* c8 ignore next 2 - unclear why c8 is unhappy here */
          } catch (err) {
            if (err.name !== 'MissingValueError') {
              /* c8 ignore next 3 */
              reject(err)
              return
            }

            missingKey = err.key
          }

          const isLocal = missingKey && client.url === `{${missingKey}}`

          /* c8 ignore next 20 - unclear why c8 is unhappy for nearly 20 lines here */
          if (!clientName) {
            const clientAbsolutePath = pathResolve(service.path, client.path)
            const clientPackageJson = join(clientAbsolutePath, 'package.json')
            const clientMetadata = JSON.parse(await readFile(clientPackageJson, 'utf8'))

            clientName = clientMetadata.name ?? ''
          }

          if (clientUrl === undefined) {
            // Combine the service name with the client name to avoid collisions
            // if two or more services have a client with the same name pointing
            // to different services.
            clientUrl = isLocal ? `http://${clientName}.plt.local` : client.url
          }

          service.dependencies.push({
            id: clientName,
            url: clientUrl,
            local: isLocal
          })

          const dependency = configManager.current.serviceMap.get(clientName)

          /* c8 ignore next 4 */
          if (dependency === undefined) {
            reject(new Error(`service '${service.id}' has unknown dependency: '${clientName}'`))
            return
          }

          dependency.dependents.push(service.id)

          if (isLocal) {
            service.localServiceEnvVars.set(missingKey, clientUrl)
          }

          resolve()
        })
      })

      await Promise.all(promises)
    }
  }
}

function topologicalSort (configManager) {
  const { services } = configManager.current
  const topo = new Topo.Sorter()

  for (let i = 0; i < services.length; ++i) {
    const service = services[i]
    const dependencyIds = service.dependencies.map(dep => dep.id)

    topo.add(service, { group: service.id, after: dependencyIds, manual: true })
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
  schema,
  allowToWatch: ['.env'],
  async transformConfig () {
    await _transformConfig(this)
  }
}

async function wrapConfigInRuntimeConfig ({ configManager, args }) {
  /* c8 ignore next */
  const id = basename(configManager.dirname) || 'main'
  const wrapperConfig = {
    $schema: schema.$id,
    entrypoint: id,
    allowCycles: false,
    hotReload: true,
    services: [
      {
        id,
        path: configManager.dirname,
        config: configManager.fullPath
      }
    ]
  }
  const cm = new ConfigManager({ source: wrapperConfig, schema })

  await _transformConfig(cm)
  await cm.parseAndValidate()
  return cm
}

module.exports = { platformaticRuntime, wrapConfigInRuntimeConfig }
