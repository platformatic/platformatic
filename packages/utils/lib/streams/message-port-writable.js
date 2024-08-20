'use strict'

const { DestinationWritable } = require('./destination-writable')

class MessagePortWritable extends DestinationWritable {
  #port

  constructor (options) {
    const { port, ...opts } = options

    super(opts)
    this.#port = port
  }

  _send (message) {
    this.#port.postMessage(message)
  }

  // Since this is only invoked by pino, we only receive strings
  _close () {
    this.#port.close()
  }
}

module.exports = { MessagePortWritable }
