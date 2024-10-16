'use strict'

const cacheInterceptor = require('@platformatic/undici-cache-interceptor')

class SharedCacheStore {
  #cacheStore

  constructor (httpCacheConfig) {
    const { store, ...storeConfig } = httpCacheConfig

    const CacheStore = store
      ? require(store)
      : cacheInterceptor.cacheStores.MemoryCacheStore

    this.#cacheStore = new CacheStore(storeConfig)
  }

  isFull () {
    return this.#cacheStore.isFull
  }

  async getValue (req) {
    const readStream = await this.#cacheStore.createReadStream(req)
    if (!readStream) return null

    let payload = ''
    for await (const chunk of readStream) {
      payload += chunk
    }

    const response = readStream.value
    return { response, payload }
  }

  setValue (req, opts, data) {
    const writeStream = this.#cacheStore.createWriteStream(req, opts)
    writeStream.write(data)
    writeStream.end()
    return null
  }

  deleteByOrigin (origin) {
    return this.#cacheStore.deleteByOrigin(origin)
  }
}

module.exports = { SharedCacheStore }
