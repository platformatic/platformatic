'use strict'

const { Writable } = require('node:stream')

class CustomCacheStore {
  constructor () {
    this.counter = 0
  }

  async get () {
    if (++this.counter > 5) return

    return {
      statusCode: 200,
      headers: {
        'content-type': 'application/json'
      },
      body: 'Custom cache store response',
      cacheTags: [],
      cachedAt: Date.now(),
      staleAt: Date.now() + 5000,
      deleteAt: Date.now() + 5000
    }
  }

  createWriteStream () {
    return new Writable({
      write (chunk, encoding, callback) { callback() },
      final (callback) { callback() }
    })
  }

  delete () {}
}

module.exports = CustomCacheStore
