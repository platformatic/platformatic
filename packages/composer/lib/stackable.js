'use strict'

const { ServiceStackable } = require('@platformatic/service')

const kITC = Symbol.for('plt.runtime.itc')

async function ensureServices (composerId, config) {
  if (config.composer?.services?.length) {
    return
  }

  composerId ??= globalThis.platformatic?.serviceId
  config.composer ??= {}
  config.composer.services ??= []

  // When no services are defined, all services are exposed in the composer
  const services = await globalThis[kITC]?.send('listServices')

  if (services) {
    config.composer.services = services
      .filter(id => id !== composerId) // Remove ourself
      .map(id => ({ id, proxy: { prefix: `/${id}` } }))
  }
}

class ComposerStackable extends ServiceStackable {
  #meta
  #dependencies

  async getBootstrapDependencies () {
    await ensureServices(this.serviceId, this.configManager.current)

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

    this.#dependencies = dependencies
    return this.#dependencies
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

  async isHealthy () {
    // Still booting, assume healthy
    if (!this.#dependencies) {
      return true
    }

    const unstarted = new Set(this.#dependencies.map(dep => dep.id))
    const workers = await globalThis[kITC].send('getWorkers')

    for (const worker of Object.values(workers)) {
      if (worker.status === 'started') {
        unstarted.delete(worker.service)
      }
    }

    return unstarted.size === 0
  }

  async #parseDependency (id, urlString) {
    let url = `http://${id}.plt.local`

    if (urlString) {
      const remoteUrl = await this.configManager.replaceEnv(urlString)

      if (remoteUrl) {
        url = remoteUrl
      }
    }

    return { id, url, local: url.endsWith('.plt.local') }
  }
}
module.exports = { ComposerStackable, ensureServices }
