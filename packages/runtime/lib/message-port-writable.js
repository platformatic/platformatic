'use strict'
const assert = require('node:assert')
const { Writable } = require('node:stream')

class MessagePortWritable extends Writable {
  constructor (options) {
    const opts = { ...options, objectMode: true }

    super(opts)
    this.port = opts.port
    this.metadata = opts.metadata
  }

  _writev (chunks, callback) {
    // Process the logs here before trying to send them across the thread
    // boundary. Sometimes the chunks have an undocumented method on them
    // which will prevent sending the chunk itself across threads.
    const logs = chunks.map((chunk) => {
      // pino should always produce a string here.
      assert(typeof chunk.chunk === 'string')
      return chunk.chunk.trim()
    })

    this.port.postMessage({
      metadata: this.metadata,
      logs
    })
    setImmediate(callback)
  }

  _final (callback) {
    this.port.close()
    callback()
  }

  _destroy (err, callback) {
    this.port.close()
    callback(err)
  }
}

module.exports = { MessagePortWritable }
