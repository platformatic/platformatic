'use strict'

const { Writable } = require('node:stream')

class DestinationWritable extends Writable {
  #metadata

  constructor (options) {
    const { metadata, ...opts } = options

    super({ ...opts, decodeStrings: false })
    this.#metadata = metadata
  }

  _send (message) {
    throw new Error('DestinationWritable._send not implemented')
  }

  _close () {
    // Default is a no-op
  }

  // Since this is only invoked by pino, we only receive strings
  _write (chunk, encoding, callback) {
    this._send({ metadata: this.#metadata, logs: [chunk.toString(encoding ?? 'utf-8')] })

    // Important: do not remove nextTick otherwise _writev will never be used
    process.nextTick(callback)
  }

  // Since this is only invoked by pino, we only receive strings
  _writev (chunks, callback) {
    this._send({ metadata: this.#metadata, logs: chunks.map(c => c.chunk.toString(c.encoding ?? 'utf-8')) })

    // Important: do not remove nextTick otherwise _writev will never be used
    process.nextTick(callback)
  }

  _final (callback) {
    this._close()
    callback()
  }

  _destroy (err, callback) {
    this._close()
    callback(err)
  }
}

module.exports = { DestinationWritable }
