'use strict'

const { Writable } = require('node:stream')

class MessagePortWritable extends Writable {
  constructor (options) {
    const opts = { ...options, objectMode: true }

    super(opts)
    this.port = opts.port
    this.metadata = opts.metadata
  }

  _write (chunk, encoding, callback) {
    this.port.postMessage({ metadata: this.metadata, logs: [chunk.toString().trim()] })
    callback()
  }

  _writev (chunks, callback) {
    // Process the logs here before trying to send them across the thread
    // boundary. Sometimes the chunks have an undocumented method on them
    // which will prevent sending the chunk itself across threads.
    const logs = []

    for (const { chunk } of chunks) {
      if (typeof chunk === 'string') {
        logs.push(chunk.trim())
      }
    }

    this.port.postMessage({ metadata: this.metadata, logs })
    callback()
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
