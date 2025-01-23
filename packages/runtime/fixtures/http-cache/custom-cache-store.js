'use strict'

const { Writable } = require('node:stream')

class CustomCacheStore {
  constructor (opts = {}) {
    this.opts = opts
    this.counter = 0
    this.entries = []
  }

  async get () {
    if (++this.counter > 5) return

    const entry = this.entries[this.entries.length - 1]
    if (entry === undefined) return

    const cachedResponse = entry.value

    const newBody = JSON.stringify({
      message: 'Custom cache store response',
      options: this.opts,
      entries: this.entries
    })

    return {
      statusCode: cachedResponse.statusCode,
      headers: {
        ...cachedResponse.headers,
        'content-length': newBody.length.toString(),
      },
      body: newBody,
      cacheTags: [],
      cachedAt: cachedResponse.cachedAt,
      staleAt: cachedResponse.staleAt,
      deleteAt: cachedResponse.deleteAt
    }
  }

  createWriteStream (key, value) {
    this.entries.push({ key, value })

    return new Writable({
      write (chunk, encoding, callback) { callback() },
      final (callback) { callback() }
    })
  }

  delete () {}
}

module.exports = CustomCacheStore
