'use strict'

const MemoryCacheStore = require('@platformatic/undici-cache-memory')

function createSharedStore (httpCacheConfig = {}) {
  const { store, ...storeConfig } = httpCacheConfig
  const CacheStore = store ? require(store) : MemoryCacheStore

  class SharedCacheStore extends CacheStore {
    async getValue (req) {
      const readStream = await this.createReadStream(req)
      if (!readStream) return null

      let payload = ''
      for await (const chunk of readStream) {
        payload += chunk
      }

      const response = readStream.value
      return { response, payload }
    }

    setValue (req, opts, data) {
      const writeStream = this.createWriteStream(req, opts)
      writeStream.write(data)
      writeStream.end()
      return null
    }
  }

  return new SharedCacheStore(storeConfig)
}

module.exports = { createSharedStore }
