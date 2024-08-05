'use strict'

const { Writable } = require('node:stream')
const inspect = require('node:util')

class PinoWritable extends Writable {
  #write

  constructor (options) {
    const { pino, level, ...opts } = options

    super({ ...opts, decodeStrings: false })
    this.#write = pino[level].bind(pino)
  }

  _write (chunk, encoding, callback) {
    this.#write({ raw: encoding === 'buffer' ? inspect(chunk) : chunk.toString(encoding ?? 'utf-8') })
    callback()
  }

  // We don't define _writev as we have to serialize messages one by one so batching wouldn't make any sense.
}

module.exports = { PinoWritable }
