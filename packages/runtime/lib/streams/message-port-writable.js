'use strict'

const { Writable } = require('node:stream')

class MessagePortWritable extends Writable {
  #port
  #metadata

  constructor (options) {
    const { port, metadata, ...opts } = options

    super({ ...opts, decodeStrings: false })
    this.#port = port
    this.#metadata = metadata
  }

  // Since this is only invoked by pino, we only receive strings
  _write (chunk, encoding, callback) {
    this.#port.postMessage({ metadata: this.#metadata, logs: [chunk.toString(encoding ?? 'utf-8')] })

    // Important: do not remove nextTick otherwise _writev will never be used
    process.nextTick(callback)
  }

  // Since this is only invoked by pino, we only receive strings
  _writev (chunks, callback) {
    this.#port.postMessage({ metadata: this.#metadata, logs: chunks.map(c => c.chunk.toString(c.encoding ?? 'utf-8')) })

    // Important: do not remove nextTick otherwise _writev will never be used
    process.nextTick(callback)
  }

  _final (callback) {
    this.#port.close()
    callback()
  }

  _destroy (err, callback) {
    this.#port.close()
    callback(err)
  }
}

module.exports = { MessagePortWritable }
