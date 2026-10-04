'use strict'

class RequestsStore extends Map {
  #drainedPromise = null
  #onDrained = null

  delete (key) {
    const deleted = super.delete(key)
    if (this.size === 0 && this.#onDrained) {
      this.#onDrained()
      this.#onDrained = null
      this.#drainedPromise = null
    }
    return deleted
  }

  drained () {
    if (this.size === 0) return

    if (this.#drainedPromise === null) {
      const { promise, resolve } = Promise.withResolvers()
      this.#drainedPromise = promise
      this.#onDrained = resolve
    }
    return this.#drainedPromise
  }
}

module.exports = { RequestsStore }
