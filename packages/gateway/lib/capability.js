import { kMetadata, replaceEnv } from '@platformatic/foundation'
import { ServiceCapability } from '@platformatic/service'
import { ensureApplications, platformaticGateway } from './application.js'
import { notHostConstraints } from './not-host-constraints.js'
import { packageJson } from './schema.js'

const kITC = Symbol.for('plt.runtime.itc')

export class GatewayCapability extends ServiceCapability {
  #meta

  constructor (root, config, context) {
    super(root, config, context)
    this.type = 'gateway'
    this.version = packageJson.version

    this.applicationFactory = this.context.applicationFactory ?? platformaticGateway
    this.fastifyOptions ??= {}
    this.fastifyOptions.routerOptions ??= {}
    this.fastifyOptions.routerOptions.constraints = { notHost: notHostConstraints }
  }

  async init () {
    if (this.status) {
      return
    }

    await ensureApplications(this.applicationId, this.config)
    const composedApplications = this.config.gateway?.applications
      .filter(this.#isLocalApplication.bind(this))
      .map(a => a.id)

    this.dependencies = Array.from(new Set([...this.dependencies, ...composedApplications]))

    await super.init()
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
    if (this.dependencies) {
      const workers = await globalThis[kITC].send('getWorkers')

      const unstarted = new Set(this.dependencies)
      for (const worker of Object.values(workers)) {
        if (worker.status === 'started') {
          unstarted.delete(worker.application)
        }
      }

      if (unstarted.size > 0) {
        globalThis.platformatic.events.emitAndNotify('unhealthy')
        return false
      }
    }

    globalThis.platformatic.events.emitAndNotify('healthy')
    return true
  }

  #isLocalApplication (application) {
    if (!application.origin) {
      return true
    }

    return replaceEnv(application.origin, this.config[kMetadata].env).endsWith('.plt.local')
  }
}
