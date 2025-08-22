import { loadModule } from '@platformatic/foundation'
import MemoryCacheStore from '@platformatic/undici-cache-memory'
import { createRequire } from 'node:module'
import { join } from 'node:path'

export async function createSharedStore (projectDir, httpCacheConfig = {}) {
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
