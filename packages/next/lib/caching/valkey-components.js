import { ensureLoggableError } from '@platformatic/foundation'
import { getConfig, getPrometheus, hasField } from '@platformatic/globals'
import { ReadableStream } from 'node:stream/web'
import {
  createPlatformaticLogger,
  deserialize,
  ensureMsgpackr,
  ensureRedis,
  getCacheFunctionId,
  getConnection,
  getEntryLifetime,
  getPlatformaticMeta,
  getPlatformaticSubprefix,
  keyFor,
  loadCacheFunctionsFiles,
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
export const IMPLICIT_TAG_PREFIX = '_N_T_'

export const sections = {
  values: 'components:values',
  tags: 'components:tags',
  revalidations: 'components:revalidations'
}

export class CacheHandler {
  #config
  #logger
  #store
  #prefix
  #subprefix
  #meta
  #cacheFunctionsFiles
  #maxTTL
  #sections
  #cacheHitMetric
  #cacheMissMetric
  #cacheHitMetricDef
  #cacheMissMetricDef

  constructor (options) {
    options ??= {}
    ensureRedis()
    ensureMsgpackr()

    const platformaticConfig = getConfig()
    const baseConfig = platformaticConfig.cache
    const resolvedConfig = options.configKey ? { ...baseConfig, ...baseConfig[options.configKey] } : baseConfig

    this.#config ??= resolvedConfig
    this.#logger ??= createPlatformaticLogger()
    this.#store ??= getConnection(this.#config.url)
    this.#maxTTL ??= this.#config.maxTTL
    this.#prefix ??= this.#config.prefix
    this.#subprefix ??= getPlatformaticSubprefix()
    this.#meta ??= getPlatformaticMeta()
    this.#sections = options.sections ?? sections
    this.#cacheHitMetricDef = options.cacheHitMetric ?? CACHE_HIT_METRIC
    this.#cacheMissMetricDef = options.cacheMissMetric ?? CACHE_MISS_METRIC

    if (!this.#config) {
      throw new Error('Please provide a the "config" option.')
    }

    if (!this.#logger) {
      throw new Error('Please provide a the "logger" option.')
    }

    if (!this.#store) {
      throw new Error('Please provide a the "store" option.')
    }

    if (hasField('prometheus')) {
      this.#registerMetrics()
    }
  }

  async get (cacheKey, _, isRedisKey) {
    this.#logger.trace({ key: cacheKey }, 'cache get')

    if (!isRedisKey && !this.#hasSubprefix()) {
      return
    }

    const key = isRedisKey ? cacheKey : this.#keyFor(cacheKey, this.#sections.values)

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
    const lifetime = getEntryLifetime(raw.revalidate, raw.expire, this.#maxTTL)

    if (this.#maxTTL < lifetime) {
      try {
        await this.#refreshKey(key, value, lifetime)
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

    try {
      // Gather the value
      const chunks = []
      for await (const chunk of value) {
        chunks.push(chunk)
      }

      if (!isRedisKey && !this.#hasSubprefix()) {
        return
      }

      const key = isRedisKey ? cacheKey : this.#keyFor(cacheKey, this.#sections.values)

      // Compute the parameters to save

      const file = await this.#fileFor(cacheKey)

      let meta = this.#meta
      if (file) {
        meta = { ...meta, file }
      }

      const toSerialize = serialize({
        maxTTL: this.#maxTTL,
        meta,
        value: Buffer.concat(chunks),
        ...data
      })
      const expire = Math.min(getEntryLifetime(revalidate, expireSec, this.#maxTTL), this.#maxTTL)

      if (expire < 1) {
        return
      }

      // Enqueue all the operations to perform in Valkey
      const promises = []
      promises.push(this.#store.set(key, toSerialize, 'EX', expire))

      // As Next.js limits tags to 64, we don't need to manage batches here
      if (Array.isArray(tags)) {
        for (const tag of tags) {
          const tagsKey = this.#keyFor(tag, this.#sections.tags)
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

  // Next.js calls this with the implicit tags of the current request (the ones revalidatePath()
  // targets) and discards any entry created before the returned timestamp.
  async getExpiration (tags) {
    if (!tags?.length || !this.#hasSubprefix()) {
      return 0
    }

    try {
      const keys = tags.map(tag => this.#keyFor(tag, this.#sections.revalidations))
      const timestamps = await this.#store.mget(keys)

      let expiration = 0
      for (const timestamp of timestamps) {
        if (timestamp) {
          expiration = Math.max(expiration, Number(timestamp))
        }
      }

      return expiration
    } catch (e) {
      this.#logger.error(
        { err: ensureLoggableError(e) },
        'Cannot read cache tags expiration from Valkey'
      )
      return 0
    }
  }

  async updateTags (tags) {
    if (!this.#hasSubprefix()) {
      return
    }

    if (typeof tags === 'string') {
      tags = [tags]
    }

    try {
      const toDelete = new Set()

      for (const tag of tags) {
        // Implicit tags are never attached to entries, so there is nothing to delete.
        // Record when they were revalidated instead, getExpiration() will check it.
        if (tag.startsWith(IMPLICIT_TAG_PREFIX)) {
          if (this.#maxTTL >= 1) {
            const revalidationKey = this.#keyFor(tag, this.#sections.revalidations)
            await this.#store.set(revalidationKey, Date.now(), 'EX', this.#maxTTL)
          }

          continue
        }

        const tagsKey = this.#keyFor(tag, this.#sections.tags)

        // For each key in the tag set, expire the key
        for await (const keys of this.#store.sscanStream(tagsKey)) {
          for (const key of keys) {
            toDelete.add(key)

            // Batch full, execute it
            if (toDelete.size >= MAX_BATCH_SIZE) {
              await this.#store.del(...toDelete)
              toDelete.clear()
            }
          }
        }

        // Spreading an empty Set would issue a DEL with no keys, which Valkey
        // rejects. Only delete when there is something to delete.
        if (toDelete.size) {
          await this.#store.del(...toDelete)
        }
        await this.#store.del(tagsKey)
      }
    } catch (e) {
      this.#logger.error({ err: ensureLoggableError(e) }, 'Cannot expire cache tags in Valkey')
      throw new Error('Cannot expire cache tags in Valkey', { cause: e })
    }
  }

  async #refreshKey (key, value, lifetime) {
    const life = Math.round((Date.now() - value.timestamp) / 1000)
    const expire = Math.min(lifetime - life, this.#maxTTL)

    if (expire < 1) {
      return
    }

    const promises = []
    promises.push(this.#store.expire(key, expire, 'gt'))

    if (Array.isArray(value.tags)) {
      for (const tag of value.tags) {
        const tagsKey = this.#keyFor(tag, this.#sections.tags)
        promises.push(this.#store.expire(tagsKey, expire, 'gt'))
      }
    }

    await Promise.all(promises)
  }

  // The manifest is read once, on the first write
  async #fileFor (cacheKey) {
    this.#cacheFunctionsFiles ??= loadCacheFunctionsFiles().catch(e => {
      this.#logger.error(
        { err: ensureLoggableError(e) },
        'Cannot read the server references manifest'
      )
      return new Map()
    })

    const files = await this.#cacheFunctionsFiles
    return files.get(getCacheFunctionId(cacheKey))
  }

  // During a build, the subprefix is only known once Next.js writes the build ID
  #hasSubprefix () {
    this.#subprefix ??= getPlatformaticSubprefix()
    return this.#subprefix !== null
  }

  #keyFor (key, section) {
    return keyFor(this.#prefix, this.#subprefix, section, key)
  }

  #registerMetrics () {
    const { client, registry } = getPrometheus()

    this.#cacheHitMetric =
      registry.getSingleMetric(this.#cacheHitMetricDef.name) ??
      new client.Counter({
        name: this.#cacheHitMetricDef.name,
        help: this.#cacheHitMetricDef.help,
        registers: [registry]
      })

    this.#cacheMissMetric =
      registry.getSingleMetric(this.#cacheMissMetricDef.name) ??
      new client.Counter({
        name: this.#cacheMissMetricDef.name,
        help: this.#cacheMissMetricDef.help,
        registers: [registry]
      })
  }
}

export default new CacheHandler()
