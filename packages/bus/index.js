'use strict'

const { EventEmitter } = require('events')

const errors = require('./lib/errors')

class Bus extends EventEmitter {
  #id
  #channel

  constructor (id) {
    super()

    this.#id = id
    this.#channel = new BroadcastChannel('plt:bus')
    this.#channel.onmessage = this.#handleMessage.bind(this)
    this.#channel.unref()
  }

  close () {
    this.#channel.close()
  }

  send (destination, type, data) {
    if (type === 'error') {
      throw new errors.InvalidArgument('type')
    }

    this.#channel.postMessage({ source: this.#id, destination, type, data })
  }

  broadcast (type, data) {
    this.send('*', type, data)
  }

  #handleMessage ({ data: message }) {
    const { type, destination } = message

    if (destination !== '*' && destination !== this.#id) {
      return
    }

    this.emit('message', message)

    if (type !== 'error') {
      this.emit(type, message)
    }
  }
}

module.exports = { Bus, errors }
