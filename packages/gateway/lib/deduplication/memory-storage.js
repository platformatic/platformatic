import { EventEmitter, once } from 'node:events'

export class MemoryDeduplicationStorage {
  #events
  #locks
  #responsesIds
  #responses

  constructor () {
    this.#events = new EventEmitter()
    this.#events.setMaxListeners(0)
    this.#locks = new Map()
    this.#responsesIds = new Map()
    this.#responses = new Map()
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

    const aborter = new AbortController()
    const timer = setTimeout(() => aborter.abort(), timeout).unref()

    try {
      const [responseId] = await once(this.#events, key, { signal: aborter.signal })
      return responseId
    } catch {
      return null
    } finally {
      clearTimeout(timer)
    }
  }

  async notify (key, responseId, ttl) {
    const previous = this.#responsesIds.get(key)
    if (previous) {
      clearTimeout(previous.timeout)
    }

    this.#events.emit(key, responseId)
    const timeout = setTimeout(() => {
      this.#responsesIds.delete(key)
    }, ttl).unref()

    this.#responsesIds.set(key, { id: responseId, timeout })
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

    this.#events.removeAllListeners()
    this.#locks.clear()
    this.#responsesIds.clear()
    this.#responses.clear()
  }
}
