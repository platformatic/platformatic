import { kMetadata, replaceEnv } from '@platformatic/foundation'
import { ServiceCapability } from '@platformatic/service'
import { ensureApplications, platformaticGateway } from './application.js'
import { notHostConstraints } from './not-host-constraints.js'
import { packageJson } from './schema.js'

const kITC = Symbol.for('plt.runtime.itc')

export class GatewayCapability extends ServiceCapability {
  #meta
  #dependencies

  constructor (root, config, context) {
    super(root, config, context)
    this.type = 'gateway'
    this.version = packageJson.version

    this.applicationFactory = this.context.applicationFactory ?? platformaticGateway
    this.fastifyOptions ??= {}
    this.fastifyOptions.routerOptions ??= {}
    this.fastifyOptions.routerOptions.constraints = { notHost: notHostConstraints }
  }

  async getBootstrapDependencies () {
    await ensureApplications(this.applicationId, this.config)

    const composedApplications = this.config.gateway?.applications
    const dependencies = []

    if (Array.isArray(composedApplications)) {
      dependencies.push(
        ...(await Promise.all(
          composedApplications.map(async application => {
            return this.#parseDependency(application.id, application.origin)
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
    const applicationMeta = super.getMeta()
    const gatewayMeta = this.#meta ? { gateway: this.#meta } : undefined

    return {
      ...applicationMeta,
      ...gatewayMeta
    }
  }

  async isHealthy () {
    // If no dependencies (still booting), assume healthy
    if (this.#dependencies) {
      const composedApplications = this.#dependencies.map(dep => dep.id)
      const workers = await globalThis[kITC].send('getWorkers')

      for (const worker of Object.values(workers)) {
        if (composedApplications.includes(worker.application) && !worker.status.startsWith('start')) {
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
