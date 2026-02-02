import { ensureLoggableError } from '@platformatic/foundation'
import { ReadableStream } from 'node:stream/web'
import {
  createPlatformaticLogger,
  deserialize,
  getConnection,
  getPlatformaticMeta,
  getPlatformaticSubprefix,
  keyFor,
  serialize
} from './valkey-common.js'

export const CACHE_HIT_METRIC = {
  name: 'next_components_cache_valkey_hit_count',
  help: 'Next.js Components Cache (Valkey) Hit Count'
}
export const CACHE_MISS_METRIC = {
  name: 'next_components_cache_valkey_miss_count',
  help: 'Next.js Components Cache (Valkey) Miss Count'
}
export const MAX_BATCH_SIZE = 100

export const sections = {
  values: 'components:values',
  tags: 'components:tags'
}

export class CacheHandler {
  #config
  #logger
  #store
  #prefix
  #subprefix
  #meta
  #maxTTL
  #cacheHitMetric
  #cacheMissMetric

  constructor () {
    this.#config ??= globalThis.platformatic.config.cache
    this.#logger ??= createPlatformaticLogger()
    this.#store ??= getConnection(this.#config.url)
    this.#maxTTL ??= this.#config.maxTTL
    this.#prefix ??= this.#config.prefix
    this.#subprefix ??= getPlatformaticSubprefix()
    this.#meta ??= getPlatformaticMeta()

    if (!this.#config) {
      throw new Error('Please provide a the "config" option.')
    }

    if (!this.#logger) {
      throw new Error('Please provide a the "logger" option.')
    }

    if (!this.#store) {
      throw new Error('Please provide a the "store" option.')
    }

    if (globalThis.platformatic) {
      this.#registerMetrics()
    }
  }

  async get (cacheKey, _, isRedisKey) {
    this.#logger.trace({ key: cacheKey }, 'cache get')

    const key = isRedisKey ? cacheKey : this.#keyFor(cacheKey, sections.values)

    let rawValue
    try {
      rawValue = await this.#store.get(key)

      if (!rawValue) {
        this.#cacheMissMetric?.inc()
        return
      }
    } catch (e) {
      this.#cacheMissMetric?.inc()
      this.#logger.error({ err: ensureLoggableError(e) }, 'Cannot read cache value from Valkey')

      return
    }

    let raw
    try {
      raw = deserialize(rawValue)
    } catch (e) {
      this.#cacheMissMetric?.inc()
      this.#logger.error({ err: ensureLoggableError(e) }, 'Cannot deserialize cache value from Valkey')

      // Avoid useless reads the next time
      // Note that since the value was unserializable, we don't know its tags and thus
      // we cannot remove it from the tags sets. TTL will take care of them.
      await this.#store.del(key)

      return
    }

    const { maxTTL: _maxTTL, meta: _meta, ...value } = raw

    if (this.#maxTTL < raw.revalidate) {
      try {
        await this.#refreshKey(key, value)
      } catch (e) {
        this.#logger.error({ err: ensureLoggableError(e) }, 'Cannot refresh cache key expiration in Valkey')
      }
    }

    // Convert the value back to a web ReadableStream. Sob.
    const buffer = value.value
    value.value = new ReadableStream({
      start (controller) {
        controller.enqueue(buffer)
        controller.close()
      }
    })

    this.#cacheHitMetric?.inc()
    return value
  }

  async set (cacheKey, dataPromise, isRedisKey) {
    const { value, ...data } = await dataPromise
    const { expire: expireSec, tags, revalidate } = data

    this.#logger.trace({ key: cacheKey, value, tags, revalidate }, 'cache set')

    const key = isRedisKey ? cacheKey : this.#keyFor(cacheKey, sections.values)

    try {
      // Gather the value
      const chunks = []
      for await (const chunk of value) {
        chunks.push(chunk)
      }

      // Compute the parameters to save
      const toSerialize = serialize({
        maxTTL: this.#maxTTL,
        meta: this.#meta,
        value: Buffer.concat(chunks),
        ...data
      })
      const expire = Math.min(revalidate, expireSec, this.#maxTTL)

      if (expire < 1) {
        return
      }

      // Enqueue all the operations to perform in Valkey
      const promises = []
      promises.push(this.#store.set(key, toSerialize, 'EX', expire))

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

  // This function is not necessary as we don't have a local state to synchronize.
  async refreshTags () {}

  getExpiration (_tags) {
    // Delegates the check to get method, only when appropriate.
    return Number.POSITIVE_INFINITY
  }

  async updateTags (tags) {
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
    const life = Math.round((Date.now() - value.timestamp) / 1000)
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

  #keyFor (key, section) {
    return keyFor(this.#prefix, this.#subprefix, section, key)
  }

  #registerMetrics () {
    const { client, registry } = globalThis.platformatic.prometheus

    this.#cacheHitMetric =
      registry.getSingleMetric(CACHE_HIT_METRIC.name) ??
      new client.Counter({
        name: CACHE_HIT_METRIC.name,
        help: CACHE_HIT_METRIC.help,
        registers: [registry]
      })

    this.#cacheMissMetric =
      registry.getSingleMetric(CACHE_MISS_METRIC.name) ??
      new client.Counter({
        name: CACHE_MISS_METRIC.name,
        help: CACHE_MISS_METRIC.help,
        registers: [registry]
      })
  }
}

export default new CacheHandler()
