'use strict'

const { Readable, Writable } = require('node:stream')
const { kITC } = require('./symbols')

class RemoteCacheStore {
  get isFull () {
    // TODO: make an itc call to the shared cache when interceptor supports
    // an async isFull method
    return false
  }

  async createReadStream (request) {
    const itc = globalThis[kITC]
    if (!itc) return

    const cachedValue = await itc.send('getHttpCacheValue', {
      request: this.#sanitizeRequest(request)
    })
    if (!cachedValue) return

    const readable = new Readable({
      read () {}
    })

    Object.defineProperty(readable, 'value', {
      get () { return cachedValue.response }
    })

    readable.push(cachedValue.payload)
    readable.push(null)

    return readable
  }

  createWriteStream (request, response) {
    const itc = globalThis[kITC]
    if (!itc) throw new Error('Cannot write to cache without an ITC instance')

    let payload = ''

    request = this.#sanitizeRequest(request)
    response = this.#sanitizeResponse(response)

    return new Writable({
      write (chunk, encoding, callback) {
        payload += chunk
        callback()
      },
      final (callback) {
        itc.send('setHttpCacheValue', { request, response, payload })
          .then(() => callback())
          .catch((err) => callback(err))
      }
    })
  }

  deleteByOrigin (origin) {
    const itc = globalThis[kITC]
    if (!itc) throw new Error('Cannot delete from cache without an ITC instance')

    itc.send('deleteHttpCacheValue', { origin })
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

  #sanitizeResponse (response) {
    return {
      ...response,
      rawHeaders: response.rawHeaders.map(header => header.toString())
    }
  }
}

module.exports = RemoteCacheStore
