import { importFile } from '@platformatic/basic'
import { registerHooks } from 'node:module'
import { toApplicationUrl, toFetchInit } from './http.js'
import { createExecutionContext, drainWaitUntil, env } from './shims/workers.js'

const kWorkersModuleRegistered = Symbol.for('plt.lavoratore.workersModuleRegistered')
const workersModuleUrl = new URL('./shims/workers.js', import.meta.url).href

// Bindings which are not supported
const unsupportedBindings = ['kv_namespaces', 'd1_databases', 'r2_buckets', 'durable_objects', 'queues']

function registerWorkersModule () {
  if (globalThis[kWorkersModuleRegistered]) {
    return
  }

  globalThis[kWorkersModuleRegistered] = true

  registerHooks({
    resolve (specifier, context, nextResolve) {
      if (specifier === 'cloudflare:workers') {
        return { url: workersModuleUrl, format: 'module', shortCircuit: true }
      }

      return nextResolve(specifier, context)
    }
  })
}

function createServiceBinding (application) {
  return {
    fetch (input, init) {
      const request = new Request(input, init)
      return fetch(toApplicationUrl(request.url, application), toFetchInit(request))
    }
  }
}

export class WorkerRunner {
  #entrypoint
  #wrangler
  #vars
  #services
  #logger
  #worker

  constructor ({ entrypoint, wrangler, vars, services, logger }) {
    this.#entrypoint = entrypoint
    this.#wrangler = wrangler
    this.#vars = vars
    this.#services = services
    this.#logger = logger
  }

  async start () {
    for (const binding of unsupportedBindings) {
      if (this.#wrangler[binding]) {
        this.#logger.warn(
          `The "${binding}" bindings in the Wrangler configuration file are not supported and will be ignored.`
        )
      }
    }

    Object.assign(env, this.#vars)

    for (const [binding, application] of Object.entries(this.#services)) {
      env[binding] = createServiceBinding(application)
    }

    registerWorkersModule()

    const imported = await importFile(this.#entrypoint)
    this.#worker = imported.default

    if (!this.#worker || (typeof this.#worker !== 'object' && typeof this.#worker !== 'function')) {
      throw new Error(`The Worker "${this.#entrypoint}" must have a default export.`)
    }
  }

  fetch (request) {
    return this.#invoke('fetch', request)
  }

  async scheduled (cron, scheduledTime) {
    await this.#invoke('scheduled', { type: 'scheduled', cron, scheduledTime, noRetry () {} })
  }

  async stop () {
    await drainWaitUntil()
  }

  #invoke (method, payload) {
    const ctx = createExecutionContext()

    // Class based Workers (i.e. extending WorkerEntrypoint) are instantiated for each invocation
    if (typeof this.#worker === 'function') {
      const instance = new this.#worker(ctx, env)

      if (typeof instance[method] !== 'function') {
        throw new Error(`The Worker does not implement the "${method}" handler.`)
      }

      return instance[method](payload)
    }

    if (typeof this.#worker[method] !== 'function') {
      throw new Error(`The Worker does not implement the "${method}" handler.`)
    }

    return this.#worker[method](payload, env, ctx)
  }
}
