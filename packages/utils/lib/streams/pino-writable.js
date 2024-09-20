'use strict'

const { Writable } = require('node:stream')
const inspect = require('node:util')

class PinoWritable extends Writable {
  #write
  #ignoreEmpty
  #hadOutput

  constructor (options) {
    const { pino, level, ignoreEmpty, ...opts } = options

    super({ ...opts, decodeStrings: false })
    this.#write = pino[level].bind(pino)
    this.#ignoreEmpty = ignoreEmpty
    this.#hadOutput = false
  }

  _write (chunk, encoding, callback) {
    const raw = encoding === 'buffer' ? inspect(chunk) : chunk.toString(encoding ?? 'utf-8')

    if (raw.trim().length === 0) {
      if (this.#ignoreEmpty && !this.#hadOutput) {
        callback()
        return
      }
    } else {
      this.#hadOutput = true
    }

    this.#write({ raw })
    callback()
  }

  // We don't define _writev as we have to serialize messages one by one so batching wouldn't make any sense.
}

function createPinoWritable (pino, level, ignoreEmpty) {
  const writable = new PinoWritable({ pino, level, ignoreEmpty })
  writable.write = writable.write.bind(writable)
  return writable
}

module.exports = { PinoWritable, createPinoWritable }
