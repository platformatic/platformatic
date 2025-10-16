import { buildPinoFormatters, buildPinoTimestamp, ensureLoggableError } from '@platformatic/foundation'
import { Redis } from 'iovalkey'
import { pack, unpack } from 'msgpackr'
import { existsSync, readFileSync } from 'node:fs'
import { hostname } from 'node:os'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pino } from 'pino'

const CACHE_HIT_METRIC = { name: 'next_cache_valkey_hit_count', help: 'Next.js Cache (Valkey) Hit Count' }
const CACHE_MISS_METRIC = { name: 'next_cache_valkey_miss_count', help: 'Next.js Cache (Valkey) Miss Count' }

const clients = new Map()

export const MAX_BATCH_SIZE = 100

export const sections = {
  values: 'values',
  tags: 'tags'
}

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
  #standalone
  #config
  #logger
  #store
  #prefix
  #subprefix
  #meta
  #maxTTL
  #cacheHitMetric
  #cacheMissMetric

  constructor (options) {
    options ??= {}

    this.#standalone = options.standalone
    this.#config = options.config
    this.#logger = options.logger
    this.#store = options.store
    this.#maxTTL = options.maxTTL
    this.#prefix = options.prefix
    this.#subprefix = options.subprefix
    this.#meta = options.meta

    if (!this.#standalone && globalThis.platformatic) {
      this.#config ??= globalThis.platformatic.config.cache
      this.#logger ??= this.#createPlatformaticLogger()
      this.#store ??= getConnection(this.#config.url)
      this.#maxTTL ??= this.#config.maxTTL
      this.#prefix ??= this.#config.prefix
      this.#subprefix ??= this.#getPlatformaticSubprefix()
      this.#meta ??= this.#getPlatformaticMeta()
    } else {
      this.#config ??= {}
      this.#maxTTL ??= 86_400
      this.#prefix ??= ''
      this.#subprefix ??= ''
      this.#meta ??= {}
    }

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

    const key = this.#standalone || isRedisKey ? cacheKey : this.#keyFor(cacheKey, sections.values)

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
      throw new Error('Cannot read cache value from Valkey', { cause: e })
    }

    let value
    try {
      value = this.#deserialize(rawValue)
    } catch (e) {
      this.#cacheMissMetric?.inc()
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

    this.#cacheHitMetric?.inc()
    return value
  }

  async set (cacheKey, value, ctx, isRedisKey) {
    const tags = ctx.tags
    const revalidate = ctx.revalidate ?? ctx.cacheControl?.revalidate ?? value.revalidate ?? 0

    this.#logger.trace({ key: cacheKey, value, tags, revalidate }, 'cache set')

    const key = this.#standalone || isRedisKey ? cacheKey : this.#keyFor(cacheKey, sections.values)

    try {
      // Compute the parameters to save
      const data = this.#serialize({
        value,
        tags,
        lastModified: Date.now(),
        revalidate,
        maxTTL: this.#maxTTL,
        ...this.#meta
      })
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
    this.#logger.trace({ key: cacheKey }, 'cache remove')

    const key = this.#standalone || isRedisKey ? cacheKey : this.#keyFor(cacheKey, sections.values)

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
          promises.push(this.#store.srem(tagsKey, key))
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
    this.#logger.trace({ tags }, 'cache revalidateTag')

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

  #createPlatformaticLogger () {
    const loggerConfig = globalThis.platformatic?.config?.logger

    const pinoOptions = {
      ...loggerConfig,
      level: globalThis.platformatic?.logLevel ?? loggerConfig?.level ?? 'info'
    }
    if (pinoOptions.formatters) {
      pinoOptions.formatters = buildPinoFormatters(pinoOptions.formatters)
    }
    if (pinoOptions.timestamp) {
      pinoOptions.timestamp = buildPinoTimestamp(pinoOptions.timestamp)
    }

    if (this.applicationId) {
      pinoOptions.name = `cache:${this.applicationId}`
    }

    if (pinoOptions.base !== null) {
      pinoOptions.base = {
        ...(pinoOptions.base ?? {}),
        pid: process.pid,
        hostname: hostname(),
        worker: this.workerId
      }
    } else if (pinoOptions.base === null) {
      pinoOptions.base = undefined
    }

    return pino(pinoOptions)
  }

  #getPlatformaticSubprefix () {
    const root = fileURLToPath(globalThis.platformatic.root)

    return existsSync(resolve(root, '.next/BUILD_ID'))
      ? (this.#subprefix = readFileSync(resolve(root, '.next/BUILD_ID'), 'utf-8').trim())
      : 'development'
  }

  #getPlatformaticMeta () {
    return {
      applicationId: globalThis.platformatic.applicationId,
      workerId: globalThis.platformatic.workerId
    }
  }

  #keyFor (key, section) {
    return keyFor(this.#prefix, this.#subprefix, section, key)
  }

  #serialize (data) {
    return pack(data).toString('base64url')
  }

  #deserialize (data) {
    return unpack(Buffer.from(data, 'base64url'))
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

export default CacheHandler
