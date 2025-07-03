'use strict'

const { ServiceStackable } = require('@platformatic/service')
const { ensureServices, platformaticComposer } = require('./application')
const { packageJson } = require('./schema')
const notHostConstraints = require('./not-host-constraints')

const kITC = Symbol.for('plt.runtime.itc')

class ComposerStackable extends ServiceStackable {
  #meta
  #dependencies

  constructor (options, root, configManager) {
    super(options, root, configManager)
    this.type = 'composer'
    this.version = packageJson.version

    this.applicationFactory = this.context.applicationFactory ?? platformaticComposer

    this.fastifyOptions ??= {}
    this.fastifyOptions.constraints = { notHost: notHostConstraints }
  }

  async getBootstrapDependencies () {
    await ensureServices(this.serviceId, this.configManager.current)

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

    const composedServices = this.#dependencies.map(dep => dep.id)
    const workers = await globalThis[kITC].send('getWorkers')

    for (const worker of Object.values(workers)) {
      if (composedServices.includes(worker.service) && !worker.status.startsWith('start')) {
        return false
      }
    }

    return true
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

module.exports = { ComposerStackable }
