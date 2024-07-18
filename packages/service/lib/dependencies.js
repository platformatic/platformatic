'use strict'

const { resolve } = require('node:path')

function getClientId (service, client) {
  let id

  if (client.path) {
    try {
      const clientPackageJsonPath = resolve(service.path, client.path, 'package.json')

      // Let's use require here so we can avoid double parsing
      id = require(clientPackageJsonPath, 'utf8').name ?? client.id
    } catch (err) {
      if (client.url === undefined || client.name === undefined) {
        throw err
      }
    }
  }

  // This function can also be called for composer services
  // which don't have a path, so using their id as fallback is reasonable
  return id ?? client.id
}

function getServiceUrl (id) {
  return `http://${id}.plt.local`
}

async function parseDependency (configManager, id, urlString) {
  let url = getServiceUrl(id)

  if (urlString) {
    try {
      const remoteUrl = await configManager.replaceEnv(urlString)

      if (remoteUrl) {
        url = remoteUrl
      }
    } catch (err) {
      // The MissingValueError is an error coming from pupa
      // https://github.com/sindresorhus/pupa#missingvalueerror
      // All other errors are simply re-thrown.
      if (err.name !== 'MissingValueError' || urlString !== `{${err.key}}`) {
        throw err
      }
    }
  }

  return { id, url, local: url.endsWith('.plt.local') }
}

// By default a service has no dependencies
async function getBootstrapDependencies (service, configManager) {
  return []
}

module.exports = {
  getClientId,
  parseDependency,
  getBootstrapDependencies
}
