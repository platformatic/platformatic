'use strict'

const { randomUUID } = require('node:crypto')
const { Readable, Writable } = require('node:stream')
const { interceptors } = require('undici')
const opentelemetry = require('@opentelemetry/api')
const { kITC } = require('./symbols')

const kIsCacheHit = Symbol('isCacheMiss')
const kCacheIdHeader = Symbol('cacheIdHeader')
const CACHE_ID_HEADER = 'x-plt-http-cache-id'

const noop = () => {}

class RemoteCacheStore {
  #onRequest
  #onCacheHit
  #onCacheMiss
  #logger

  constructor (opts = {}) {
    this.#onRequest = opts.onRequest ?? noop
    this.#onCacheHit = opts.onCacheHit ?? noop
    this.#onCacheMiss = opts.onCacheMiss ?? noop
    this.#logger = opts.logger
  }

  async get (request) {
    try {
      this.#onRequest(request)
    } catch (err) {
      this.#logger.error(err, 'Error in onRequest http cache hook')
    }

    const itc = globalThis[kITC]
    if (!itc) return

    const cachedValue = await itc.send('getHttpCacheValue', {
      request: this.#sanitizeRequest(request)
    })
    if (!cachedValue) {
      try {
        this.#onCacheMiss(request)
      } catch (err) {
        this.#logger.error(err, 'Error in onCacheMiss http cache hook')
      }
      return
    }

    const readable = new Readable({ read () {} })
    readable.push(cachedValue.payload)
    readable.push(null)

    try {
      this.#onCacheHit(request, cachedValue.response)
    } catch (err) {
      this.#logger.error(err, 'Error in onCacheHit http cache hook')
    }

    return {
      ...cachedValue.response,
      body: readable
    }
  }

  createWriteStream (key, value) {
    const cacheEntryId = value.headers?.[kCacheIdHeader]
    if (cacheEntryId) {
      key = { ...key, id: cacheEntryId }
      value.headers = { ...value.headers, [CACHE_ID_HEADER]: cacheEntryId }
    }

    addCacheEntryIdToSpan(cacheEntryId)

    const itc = globalThis[kITC]
    if (!itc) throw new Error('Cannot write to cache without an ITC instance')

    let payload = ''

    key = this.#sanitizeRequest(key)

    return new Writable({
      write (chunk, encoding, callback) {
        payload += chunk
        callback()
      },
      final (callback) {
        itc.send('setHttpCacheValue', { request: key, response: value, payload })
          .then(() => callback())
          .catch((err) => callback(err))
      }
    })
  }

  delete (request) {
    const itc = globalThis[kITC]
    if (!itc) throw new Error('Cannot delete from cache without an ITC instance')

    request = this.#sanitizeRequest(request)
    itc.send('deleteHttpCacheValue', { request })
    // TODO: return a Promise
  }

  #sanitizeRequest (request) {
    return {
      origin: request.origin,
      method: request.method,
      path: request.path,
      headers: request.headers
    }
  }
}

const httpCacheInterceptor = (opts) => {
  const originalInterceptor = interceptors.cache(opts)
  return (originalDispatch) => {
    const dispatch = (opts, handler) => {
      opts[kIsCacheHit] = false
      const originOnResponseStart = handler.onResponseStart.bind(handler)
      handler.onResponseStart = (ac, statusCode, headers, statusMessage) => {
        // Setting a potentially cache entry id when cache miss happens
        headers[kCacheIdHeader] = randomUUID()
        return originOnResponseStart(ac, statusCode, headers, statusMessage)
      }

      return originalDispatch(opts, handler)
    }

    const dispatcher = originalInterceptor(dispatch)

    return (opts, handler) => {
      const originOnResponseStart = handler.onResponseStart.bind(handler)
      handler.onResponseStart = (ac, statusCode, headers, statusMessage) => {
        const cacheEntryId = headers[CACHE_ID_HEADER] ?? headers[kCacheIdHeader]
        if (cacheEntryId) {
          // Setting a cache id header on cache hit
          headers[CACHE_ID_HEADER] ??= headers[kCacheIdHeader]
          delete headers[kCacheIdHeader]

          try {
            addCacheEntryIdToSpan(cacheEntryId)
          } catch (err) {
            opts.logger.error(err, 'Error setting cache id on span')
          }
        }
        return originOnResponseStart(ac, statusCode, headers, statusMessage)
      }

      return dispatcher(opts, handler)
    }
  }
}

function addCacheEntryIdToSpan (cacheEntryId) {
  const span = opentelemetry.trace.getActiveSpan()
  if (!span || !span.attributes['http.request.method']) return
  span.setAttribute('http.cache.id', cacheEntryId)
}

module.exports = { RemoteCacheStore, httpCacheInterceptor }
