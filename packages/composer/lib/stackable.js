'use strict'

const { ServiceStackable } = require('@platformatic/service')

class ComposerStackable extends ServiceStackable {
  #meta

  async getBootstrapDependencies () {
    // We do not call init() on purpose, as we don't want to load the up just yet.

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
module.exports = { ComposerStackable }
