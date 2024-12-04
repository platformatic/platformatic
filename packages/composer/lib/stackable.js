'use strict'

const { ServiceStackable } = require('@platformatic/service')

const kITC = Symbol.for('plt.runtime.itc')

async function ensureServices (config) {
  if (config.composer?.services?.length) {
    return
  }

  config.composer ??= {}
  config.composer.services ??= []

  // When no services are defined, all services are exposed in the composer
  const services = await globalThis[kITC]?.send('listServices')

  if (services) {
    config.composer.services = services
      .filter(id => id !== globalThis.platformatic.serviceId) // Remove ourself
      .map(id => ({ id, proxy: { prefix: `/${id}` } }))
  }
}

class ComposerStackable extends ServiceStackable {
  #meta

  async getBootstrapDependencies () {
    await ensureServices(this.configManager.current)

    // We do not call init() on purpose, as we don't want to load the app just yet.

    const composedServices = this.configManager.current.composer?.services
    const dependencies = []

    if (Array.isArray(composedServices)) {
      dependencies.push(
        ...(await Promise.all(
          composedServices.map(async service => {
            return this.#parseDependency(service.id, service.origin)
          })
        ))
      )
    }

    return dependencies
  }

  async #parseDependency (id, urlString) {
    let url = this.#getServiceUrl(id)

    if (urlString) {
      const remoteUrl = await this.configManager.replaceEnv(urlString)

      if (remoteUrl) {
        url = remoteUrl
      }
    }

    return { id, url, local: url.endsWith('.plt.local') }
  }

  registerMeta (meta) {
    this.#meta = Object.assign(this.#meta ?? {}, meta)
  }

  async getMeta () {
    const serviceMeta = super.getMeta()
    const composerMeta = this.#meta ? { composer: this.#meta } : undefined

    return {
      ...serviceMeta,
      ...composerMeta
    }
  }

  #getServiceUrl (id) {
    return `http://${id}.plt.local`
  }
}
module.exports = { ComposerStackable, ensureServices }
