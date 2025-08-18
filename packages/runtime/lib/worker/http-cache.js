'use strict'

const { randomUUID } = require('node:crypto')
const { Readable, Writable } = require('node:stream')
const { interceptors } = require('undici')
const { kITC } = require('./symbols')

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

    const sanitizedRequest = this.#sanitizeRequest(request)

    const cachedValue = await itc.send('getHttpCacheValue', {
      request: sanitizedRequest
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

    const itc = globalThis[kITC]
    if (!itc) throw new Error('Cannot write to cache without an ITC instance')

    const acc = []

    key = this.#sanitizeRequest(key)

    return new Writable({
      write (chunk, encoding, callback) {
        acc.push(chunk)
        callback()
      },
      final (callback) {
        let payload
        if (acc.length > 0 && typeof acc[0] === 'string') {
          payload = acc.join('')
        } else {
          payload = Buffer.concat(acc)
        }
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
      id: request.id,
      origin: request.origin,
      method: request.method,
      path: request.path,
      headers: request.headers
    }
  }
}

const httpCacheInterceptor = (interceptorOpts) => {
  const originalInterceptor = interceptors.cache(interceptorOpts)

  // AsyncLocalStorage that contains a client http request span
  // Exists only when the nodejs capability telemetry is enabled
  const clientSpansAls = globalThis.platformatic.clientSpansAls

  return (originalDispatch) => {
    const dispatch = (opts, handler) => {
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
        const cacheEntryId = headers[kCacheIdHeader] ?? headers[CACHE_ID_HEADER]
        const isCacheHit = headers.age !== undefined

        if (cacheEntryId) {
          // Setting a cache id header on cache hit
          headers[CACHE_ID_HEADER] = cacheEntryId
          delete headers[kCacheIdHeader]

          if (clientSpansAls) {
            try {
              const { span } = clientSpansAls.getStore()
              if (span) {
                span.setAttribute('http.cache.id', cacheEntryId)
                span.setAttribute('http.cache.hit', isCacheHit.toString())
              }
            } catch (err) {
              interceptorOpts.logger.error(err, 'Error setting cache id on span')
            }
          }
        }
        return originOnResponseStart(ac, statusCode, headers, statusMessage)
      }

      if (!clientSpansAls) {
        return dispatcher(opts, handler)
      }
      return clientSpansAls.run({ span: null }, () => dispatcher(opts, handler))
    }
  }
}

module.exports = { RemoteCacheStore, httpCacheInterceptor }
