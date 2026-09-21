export class MemoryDeduplicationStorage {
  #locks
  #responsesIds
  #responses
  #waiters

  constructor () {
    this.#locks = new Map()
    this.#responsesIds = new Map()
    this.#responses = new Map()
    this.#waiters = new Map()
  }

  async lock (key, token, ttl) {
    const lock = this.#locks.get(key)
    if (lock) {
      return false
    }

    const timeout = setTimeout(() => {
      const lock = this.#locks.get(key)
      if (lock?.token === token) {
        this.#locks.delete(key)
      }
    }, ttl).unref()

    this.#locks.set(key, { token, timeout })
    return true
  }

  async unlock (key, token) {
    const lock = this.#locks.get(key)
    if (lock?.token !== token) {
      return
    }

    clearTimeout(lock.timeout)
    this.#locks.delete(key)
  }

  async wait (key, timeout) {
    const responseId = this.#responsesIds.get(key)
    if (responseId) {
      return responseId.id
    }

    const waiter = Promise.withResolvers()
    let waiters = this.#waiters.get(key)

    if (!waiters) {
      waiters = new Set()
      this.#waiters.set(key, waiters)
    }

    waiters.add(waiter)
    const timer = setTimeout(() => waiter.resolve(null), timeout).unref()

    try {
      return await waiter.promise
    } finally {
      clearTimeout(timer)
      waiters.delete(waiter)

      if (waiters.size === 0 && this.#waiters.get(key) === waiters) {
        this.#waiters.delete(key)
      }
    }
  }

  async notify (key, responseId, ttl) {
    const previous = this.#responsesIds.get(key)
    if (previous) {
      clearTimeout(previous.timeout)
    }

    const timeout = setTimeout(() => {
      this.#responsesIds.delete(key)
    }, ttl).unref()

    this.#responsesIds.set(key, { id: responseId, timeout })

    const waiters = this.#waiters.get(key)
    if (waiters) {
      this.#waiters.delete(key)

      for (const waiter of waiters) {
        waiter.resolve(responseId)
      }
    }
  }

  async getResponse (responseId) {
    return this.#responses.get(responseId)
  }

  async setResponse (responseId, response, ttl) {
    const timeout = setTimeout(() => {
      this.#responses.delete(responseId)
    }, ttl).unref()

    this.#responses.set(responseId, { ...response, timeout })
  }

  async close () {
    for (const lock of this.#locks.values()) {
      clearTimeout(lock.timeout)
    }

    for (const response of this.#responses.values()) {
      clearTimeout(response.timeout)
    }

    for (const responseId of this.#responsesIds.values()) {
      clearTimeout(responseId.timeout)
    }

    for (const waiters of this.#waiters.values()) {
      for (const waiter of waiters) {
        waiter.resolve(null)
      }
    }

    this.#locks.clear()
    this.#responsesIds.clear()
    this.#responses.clear()
    this.#waiters.clear()
  }
}
