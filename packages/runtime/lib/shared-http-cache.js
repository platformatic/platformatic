'use strict'

const cacheInterceptor = require('@platformatic/undici-cache-interceptor')

class SharedCacheStore {
  #memoryStore

  constructor (...args) {
    this.#memoryStore = new cacheInterceptor.cacheStores.MemoryCacheStore(...args)
  }

  isFull () {
    return this.#memoryStore.isFull
  }

  async getValue (req) {
    const readStream = this.#memoryStore.createReadStream(req)
    if (!readStream) return null

    let payload = ''
    for await (const chunk of readStream) {
      payload += chunk
    }

    const response = readStream.value
    return { response, payload }
  }

  setValue (req, opts, data) {
    const writeStream = this.#memoryStore.createWriteStream(req, opts)
    writeStream.write(data)
    writeStream.end()
    return null
  }

  deleteByOrigin (origin) {
    return this.#memoryStore.deleteByOrigin(origin)
  }
}

module.exports = { SharedCacheStore }
