import { ensureLoggableError } from '@platformatic/utils'
import { Redis } from 'iovalkey'
import { pack, unpack } from 'msgpackr'
import { existsSync, readFileSync } from 'node:fs'
import { hostname } from 'node:os'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pino } from 'pino'

export const MAX_BATCH_SIZE = 100

export const sections = {
  values: 'values',
  tags: 'tags'
}

const clients = new Map()

export function keyFor (prefix, subprefix, section, key) {
  return [prefix, 'cache:next', subprefix, section, key ? Buffer.from(key).toString('base64url') : undefined]
    .filter(c => c)
    .join(':')
}

export function getConnection (url) {
  let client = clients.get(url)

  if (!client) {
    client = new Redis(url, { enableAutoPipelining: true })
    clients.set(url, client)

    globalThis.platformatic.events.on('plt:next:close', () => {
      client.disconnect(false)
    })
  }

  return client
}

export class CacheHandler {
  #config
  #logger
  #store
  #subprefix
  #maxTTL

  constructor (options) {
    options ??= {}

    this.#config = options.config ?? globalThis.platformatic?.config?.cache

    if (!this.#config) {
      throw new Error('Please provide a valid configuration.')
    }

    this.#logger = options.logger ?? this.#createLogger()
    this.#store = options.store ?? getConnection(this.#config.url)
    this.#maxTTL = options.maxTTL ?? this.#config.maxTTL ?? 86_400
    this.#subprefix = options.subprefix ?? this.#getSubprefix()
  }

  async get (cacheKey, isRedisKey) {
    this.#logger.trace({ key: cacheKey }, 'get')

    const key = isRedisKey ? cacheKey : this.#keyFor(cacheKey, sections.values)

    let rawValue
    try {
      rawValue = await this.#store.get(key)

      if (!rawValue) {
        return
      }
    } catch (e) {
      this.#logger.error({ err: ensureLoggableError(e) }, 'Cannot read cache value from Valkey')
      throw new Error('Cannot read cache value from Valkey', { cause: e })
    }

    let value
    try {
      value = this.#deserialize(rawValue)
    } catch (e) {
      this.#logger.error({ err: ensureLoggableError(e) }, 'Cannot deserialize cache value from Valkey')

      // Avoid useless reads the next time
      // Note that since the value was unserializable, we don't know its tags and thus
      // we cannot remove it from the tags sets. TTL will take care of them.
      await this.#store.del(key)

      throw new Error('Cannot deserialize cache value from Valkey', { cause: e })
    }

    if (this.#maxTTL < value.revalidate) {
      try {
        await this.#refreshKey(key, value)
      } catch (e) {
        this.#logger.error({ err: ensureLoggableError(e) }, 'Cannot refresh cache key expiration in Valkey')

        // We don't throw here since we want to use the cached value anyway
      }
    }

    return value
  }

  async set (cacheKey, value, { tags, revalidate }, isRedisKey) {
    this.#logger.trace({ key: cacheKey, value, tags, revalidate }, 'set')

    const key = isRedisKey ? cacheKey : this.#keyFor(cacheKey, sections.values)

    try {
      // Compute the parameters to save
      const data = this.#serialize({ value, tags, lastModified: Date.now(), revalidate, maxTTL: this.#maxTTL })
      const expire = Math.min(revalidate, this.#maxTTL)

      if (expire < 1) {
        return
      }

      // Enqueue all the operations to perform in Valkey

      const promises = []
      promises.push(this.#store.set(key, data, 'EX', expire))

      // As Next.js limits tags to 64, we don't need to manage batches here
      if (Array.isArray(tags)) {
        for (const tag of tags) {
          const tagsKey = this.#keyFor(tag, sections.tags)
          promises.push(this.#store.sadd(tagsKey, key))
          promises.push(this.#store.expire(tagsKey, expire))
        }
      }

      // Execute all the operations
      await Promise.all(promises)
    } catch (e) {
      this.#logger.error({ err: ensureLoggableError(e) }, 'Cannot write cache value in Valkey')
      throw new Error('Cannot write cache value in Valkey', { cause: e })
    }
  }

  async remove (cacheKey, isRedisKey) {
    this.#logger.trace({ key: cacheKey }, 'remove')

    const key = isRedisKey ? cacheKey : this.#keyFor(cacheKey, sections.values)

    let rawValue
    try {
      rawValue = await this.#store.get(key)

      if (!rawValue) {
        return
      }
    } catch (e) {
      this.#logger.error({ err: ensureLoggableError(e) }, 'Cannot read cache value from Valkey')
      throw new Error('Cannot read cache value from Valkey', { cause: e })
    }

    let value
    try {
      value = this.#deserialize(rawValue)
    } catch (e) {
      this.#logger.error({ err: ensureLoggableError(e) }, 'Cannot deserialize cache value from Valkey')

      // Avoid useless reads the next time
      // Note that since the value was unserializable, we don't know its tags and thus
      // we cannot remove it from the tags sets. TTL will take care of them.
      await this.#store.del(key)

      throw new Error('Cannot deserialize cache value from Valkey', { cause: e })
    }

    try {
      const promises = []
      promises.push(this.#store.del(key))

      if (Array.isArray(value.tags)) {
        for (const tag of value.tags) {
          const tagsKey = this.#keyFor(tag, sections.tags)
          this.#store.srem(tagsKey, key, 'gt')
        }
      }

      // Execute all the operations
      await Promise.all(promises)
    } catch (e) {
      this.#logger.error({ err: ensureLoggableError(e) }, 'Cannot remove cache value from Valkey')
      throw new Error('Cannot remove cache value from Valkey', { cause: e })
    }
  }

  async revalidateTag (tags) {
    this.#logger.trace({ tags }, 'revalidateTag')

    if (typeof tags === 'string') {
      tags = [tags]
    }

    try {
      let promises = []

      for (const tag of tags) {
        const tagsKey = this.#keyFor(tag, sections.tags)

        // For each key in the tag set, expire the key
        for await (const keys of this.#store.sscanStream(tagsKey)) {
          for (const key of keys) {
            promises.push(this.#store.del(key))

            // Batch full, execute it
            if (promises.length >= MAX_BATCH_SIZE) {
              await Promise.all(promises)
              promises = []
            }
          }
        }

        // Delete the set, this will also take care of executing pending operation for a non full batch
        promises.push(this.#store.del(tagsKey))
        await Promise.all(promises)
        promises = []
      }
    } catch (e) {
      this.#logger.error({ err: ensureLoggableError(e) }, 'Cannot expire cache tags in Valkey')
      throw new Error('Cannot expire cache tags in Valkey', { cause: e })
    }
  }

  async #refreshKey (key, value) {
    const life = Math.round((Date.now() - value.lastModified) / 1000)
    const expire = Math.min(value.revalidate - life, this.#maxTTL)

    if (expire < 1) {
      return
    }

    const promises = []
    promises.push(this.#store.expire(key, expire, 'gt'))

    if (Array.isArray(value.tags)) {
      for (const tag of value.tags) {
        const tagsKey = this.#keyFor(tag, sections.tags)
        promises.push(this.#store.expire(tagsKey, expire, 'gt'))
      }
    }

    await Promise.all(promises)
  }

  #createLogger () {
    const pinoOptions = {
      level: globalThis.platformatic?.logLevel ?? 'info'
    }

    if (this.serviceId) {
      pinoOptions.name = `cache:${this.serviceId}`
    }

    if (typeof globalThis.platformatic.workerId !== 'undefined') {
      pinoOptions.base = { pid: process.pid, hostname: hostname(), worker: this.workerId }
    }

    return pino(pinoOptions)
  }

  #getSubprefix () {
    const root = fileURLToPath(globalThis.platformatic.root)

    return existsSync(resolve(root, '.next/BUILD_ID'))
      ? (this.#subprefix = readFileSync(resolve(root, '.next/BUILD_ID'), 'utf-8').trim())
      : 'development'
  }

  #keyFor (key, section) {
    return keyFor(this.#config.prefix, this.#subprefix, section, key)
  }

  #serialize (data) {
    return pack(data).toString('base64url')
  }

  #deserialize (data) {
    return unpack(Buffer.from(data, 'base64url'))
  }
}

export default CacheHandler
