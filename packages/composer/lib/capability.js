import { kMetadata, replaceEnv } from '@platformatic/foundation'
import { ServiceCapability } from '@platformatic/service'
import { ensureServices, platformaticComposer } from './application.js'
import { notHostConstraints } from './not-host-constraints.js'
import { packageJson } from './schema.js'

const kITC = Symbol.for('plt.runtime.itc')

export class ComposerCapability extends ServiceCapability {
  #meta
  #dependencies

  constructor (root, config, context) {
    super(root, config, context)
    this.type = 'composer'
    this.version = packageJson.version

    this.applicationFactory = this.context.applicationFactory ?? platformaticComposer
    this.fastifyOptions ??= {}
    this.fastifyOptions.constraints = { notHost: notHostConstraints }
  }

  async getBootstrapDependencies () {
    await ensureServices(this.serviceId, this.config)

    const composedServices = this.config.composer?.services
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
    // If no dependencies (still booting), assume healthy
    if (this.#dependencies) {
      const composedServices = this.#dependencies.map(dep => dep.id)
      const workers = await globalThis[kITC].send('getWorkers')

      for (const worker of Object.values(workers)) {
        if (composedServices.includes(worker.service) && !worker.status.startsWith('start')) {
          globalThis[kITC].notify('event', { event: 'unhealthy' })
          return false
        }
      }
    }

    globalThis[kITC].notify('event', { event: 'healthy' })
    return true
  }

  async #parseDependency (id, urlString) {
    let url = `http://${id}.plt.local`

    if (urlString) {
      const remoteUrl = await replaceEnv(urlString, this.config[kMetadata].env)

      if (remoteUrl) {
        url = remoteUrl
      }
    }

    return { id, url, local: url.endsWith('.plt.local') }
  }
}
