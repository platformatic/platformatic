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

  configure (services) {
    this.#instances = {}

    for (const service of services) {
      this.#instances[service.id] = { next: 0, count: service.workers }
    }
  }

  getCount (service) {
    return this.#instances[service].count
  }

  setCount (service, count) {
    this.#instances[service].count = count
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
