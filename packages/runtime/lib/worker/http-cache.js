'use strict'

const { Readable, Writable } = require('node:stream')
const { kITC } = require('./symbols')

class RemoteCacheStore {
  get isFull () {
    // const itc = globalThis[kITC]
    // if (!itc) return undefined
    // return await itc.send('isHttpCacheFull')
    return false
  }

  async createReadStream (req) {
    const itc = globalThis[kITC]
    if (!itc) return undefined

    const cachedValue = await itc.send('getHttpCacheValue', { req })
    if (!cachedValue) return undefined

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

  createWriteStream (req, response) {
    const itc = globalThis[kITC]
    if (!itc) return undefined

    let data = ''

    response.rawHeaders = response.rawHeaders.map(header => header.toString())

    return new Writable({
      write (chunk, encoding, callback) {
        data += chunk
        callback()
      },
      final (callback) {
        itc.send('setHttpCacheValue', { req, opts: response, data })
        callback()
      }
    })
  }

  deleteByOrigin (origin) {
    const itc = globalThis[kITC]
    if (!itc) return

    itc.send('deleteHttpCacheValue', { origin })
  }
}

module.exports = RemoteCacheStore
