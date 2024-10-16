'use strict'

const { Readable, Writable } = require('node:stream')

class CustomCacheStore {
  constructor () {
    this.counter = 0
  }

  get isFull () {
    return false
  }

  async createReadStream () {
    if (++this.counter > 5) return

    const readable = new Readable({
      read () {}
    })

    Object.defineProperty(readable, 'value', {
      get value () {
        return {
          statusCode: 200,
          rawHeaders: ['content-type', 'application/json'],
          cachedAt: Date.now(),
          staleAt: Date.now() + 5000,
          deleteAt: Date.now() + 5000
        }
      }
    })

    readable.push('Custom cache store response')
    readable.push(null)

    return readable
  }

  createWriteStream () {
    return new Writable({
      write (chunk, encoding, callback) { callback() },
      final (callback) { callback() }
    })
  }

  deleteByOrigin () {}
}

module.exports = CustomCacheStore
