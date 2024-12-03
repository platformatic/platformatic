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
      const cachedValue = await this.get(req)
      if (!cachedValue) return null

      const { body, ...response } = cachedValue

      let payload = ''
      for await (const chunk of body) {
        payload += chunk
      }

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
