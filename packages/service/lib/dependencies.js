'use strict'

const { readFile } = require('node:fs/promises')
const { resolve } = require('node:path')
const ConfigManager = require('@platformatic/config')

async function getClientId (service, client) {
  try {
    const clientPackageJsonPath = resolve(service.path, client.path, 'package.json')
    const clientPackageJSON = JSON.parse(await readFile(clientPackageJsonPath, 'utf8'))
    return clientPackageJSON.name ?? ''
  } catch (err) {
    if (client.url === undefined || client.name === undefined) {
      throw err
    }
  }
}

async function parseDependency (configManager, id, urlString) {
  let url = `http://${id}.plt.local`
  let local = true
  let envVar = null

  if (urlString) {
    try {
      const remoteUrl = await configManager.replaceEnv(urlString)

      if (remoteUrl) {
        url = remoteUrl
        local = false
      }
    } catch (err) {
      // The MissingValueError is an error coming from pupa
      // https://github.com/sindresorhus/pupa#missingvalueerror
      // All other errors are simply re-thrown.
      if (err.name !== 'MissingValueError' || urlString !== `{${err.key}}`) {
        throw err
      }

      envVar = err.key
    }
  }

  return { id, url, envVar, local }
}

async function getDependencies (service) {
  const configManager = new ConfigManager({ source: service.config })
  const configString = await configManager.load()
  const serviceConfig = configManager._parser(configString)

  if (!serviceConfig.clients || !Array.isArray(serviceConfig.clients)) {
    return []
  }

  return Promise.all(serviceConfig.clients.map(async (client) => {
    return parseDependency(
      configManager,
      client.serviceId ?? await getClientId(service, client),
      client.url
    )
  }))
}

module.exports = {
  parseDependency,
  getDependencies
}
