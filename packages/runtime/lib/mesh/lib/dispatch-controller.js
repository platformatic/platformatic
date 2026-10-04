'use strict'

const { EventEmitter } = require('node:events')

class DispatchController extends EventEmitter {
  #paused = false
  #reason = null
  #aborted = false

  get paused () {
    return this.#paused
  }

  get reason () {
    return this.#reason
  }

  get aborted () {
    return this.#aborted
  }

  pause () {
    this.#paused = true
    this.emit('pause')
  }

  resume () {
    this.#paused = false
    this.emit('resume')
  }

  abort (reason) {
    this.#aborted = true
    this.#reason = reason
    this.emit('abort', reason)
  }
}

module.exports = { DispatchController }
