'use strict'

const { join } = require('node:path')
const { createRequire } = require('node:module')
const MemoryCacheStore = require('@platformatic/undici-cache-memory')

function createSharedStore (projectDir, httpCacheConfig = {}) {
  const runtimeRequire = createRequire(join(projectDir, 'file'))

  const { store, ...storeConfig } = httpCacheConfig
  const CacheStore = store ? runtimeRequire(store) : MemoryCacheStore

  class SharedCacheStore extends CacheStore {
    async getValue (req) {
      const readStream = await this.createReadStream(req)
      if (!readStream) return null

      let payload = ''
      for await (const chunk of readStream) {
        payload += chunk
      }

      const response = this.#sanitizeResponse(readStream.value)
      return { response, payload }
    }

    setValue (req, opts, data) {
      const writeStream = this.createWriteStream(req, opts)
      writeStream.write(data)
      writeStream.end()
      return null
    }

    #sanitizeResponse (response) {
      return {
        ...response,
        rawHeaders: response.rawHeaders.map(header => header.toString())
      }
    }
  }

  return new SharedCacheStore(storeConfig)
}

module.exports = { createSharedStore }
