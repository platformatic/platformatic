'use strict'

class RoundRobinMap extends Map {
  #instances

  constructor (iterable, instances = {}) {
    super(iterable)
    this.#instances = instances
  }

  get configuration () {
    return { ...this.#instances }
  }

  configure (applications) {
    this.#instances = {}

    for (const application of applications) {
      this.#instances[application.id] = { next: application.next ?? 0, count: application.workers }
    }
  }

  getCount (application) {
    if (!this.#instances[application]) {
      return null
    }

    return this.#instances[application].count
  }

  setCount (application, count) {
    if (!this.#instances[application]) {
      throw new Error(`Application ${application} is not configured.`)
    }

    this.#instances[application].count = count
  }

  next (application) {
    if (!this.#instances[application]) {
      return null
    }

    let worker
    let { next, count } = this.#instances[application]

    // Try count times to get the next worker. This is to handle the case where a worker is being restarted.
    for (let i = 0; i < count; i++) {
      const current = next++
      if (next >= count) {
        next = 0
      }

      worker = this.get(`${application}:${current}`)

      if (worker) {
        break
      }
    }

    this.#instances[application].next = next
    return worker
  }
}

module.exports = { RoundRobinMap }
