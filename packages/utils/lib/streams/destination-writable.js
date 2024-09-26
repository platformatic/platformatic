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
    Error.stackTraceLimit = 100
    process._rawDebug(new Error().stack)
    this._send({ metadata: this.#metadata, logs: [chunk.toString(encoding ?? 'utf-8')] })

    // Important: do not remove queueMicrotask otherwise _writev will never be used
    // Do not use nextTick here, or else some logs would have to be lost during shutdown
    queueMicrotask(callback)
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
