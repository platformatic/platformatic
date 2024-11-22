'use strict'

class RoundRobinMap extends Map {
  #instances

  constructor (iterable, instances) {
    super(iterable)
    this.#instances = instances
  }

  get configuration () {
    return { ...this.#instances }
  }

  // In development or for the entrypoint always use 1 worker
  configure (services, defaultInstances, production) {
    this.#instances = {}

    for (const service of services) {
      let count = service.workers ?? defaultInstances

      if (service.entrypoint || !production) {
        count = 1
      }

      this.#instances[service.id] = { next: 0, count }
    }
  }

  getCount (service) {
    return this.#instances[service].count
  }

  next (service) {
    if (!this.#instances[service]) {
      return undefined
    }

    let worker
    let { next, count } = this.#instances[service]

    // Try count times to get the next worker. This is to handle the case where a worker is being restarted.
    for (let i = 0; i < count; i++) {
      const current = next++
      if (next >= count) {
        next = 0
      }

      worker = this.get(`${service}:${current}`)

      if (worker) {
        break
      }
    }

    this.#instances[service].next = next
    return worker
  }
}

module.exports = { RoundRobinMap }
