'use strict'

const { join } = require('node:path')
const { loadModule } = require('@platformatic/utils')
const MemoryCacheStore = require('@platformatic/undici-cache-memory')
const { createRequire } = require('node:module')

async function createSharedStore (projectDir, httpCacheConfig = {}) {
  const runtimeRequire = createRequire(join(projectDir, 'file'))

  const { store, ...storeConfig } = httpCacheConfig
  const CacheStore = store ? await loadModule(runtimeRequire, store) : MemoryCacheStore

  class SharedCacheStore extends CacheStore {
    async getValue (req) {
      const cachedValue = await this.get(req)
      if (!cachedValue) return null

      const { body, ...response } = cachedValue

      const acc = []
      for await (const chunk of body) {
        acc.push(chunk)
      }

      let payload
      if (acc.length > 0 && typeof acc[0] === 'string') {
        payload = acc.join('')
      } else {
        payload = Buffer.concat(acc)
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
