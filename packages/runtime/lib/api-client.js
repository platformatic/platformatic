'use strict'

const { once, EventEmitter } = require('node:events')
const { randomUUID } = require('node:crypto')
const errors = require('./errors')

const MAX_LISTENERS_COUNT = 100

class RuntimeApiClient extends EventEmitter {
  #exitCode
  #exitPromise

  constructor (worker) {
    super()
    this.setMaxListeners(MAX_LISTENERS_COUNT)

    this.worker = worker
    this.#exitPromise = this.#exitHandler()
    this.worker.on('message', (message) => {
      if (message.operationId) {
        this.emit(message.operationId, message)
      }
    })
  }

  async start () {
    return this.#sendCommand('plt:start-services')
  }

  async close () {
    await this.#sendCommand('plt:stop-services')
    await this.#exitPromise
  }

  async restart () {
    return this.#sendCommand('plt:restart-services')
  }

  async getServices () {
    return this.#sendCommand('plt:get-services')
  }

  async getServiceDetails (id) {
    return this.#sendCommand('plt:get-service-details', { id })
  }

  async getServiceConfig (id) {
    return this.#sendCommand('plt:get-service-config', { id })
  }

  async getServiceOpenapiSchema (id) {
    return this.#sendCommand('plt:get-service-openapi-schema', { id })
  }

  async startService (id) {
    return this.#sendCommand('plt:start-service', { id })
  }

  async stopService (id) {
    return this.#sendCommand('plt:stop-service', { id })
  }

  async inject (id, injectParams) {
    return this.#sendCommand('plt:inject', { id, injectParams })
  }

  async #sendCommand (command, params = {}) {
    const operationId = randomUUID()

    this.worker.postMessage({ operationId, command, params })
    const [message] = await Promise.race(
      [once(this, operationId), this.#exitPromise]
    )

    if (this.#exitCode !== undefined) {
      throw new errors.RuntimeExitedError()
    }

    const { error, data } = message
    if (error !== null) {
      throw new Error(error)
    }

    return JSON.parse(data)
  }

  async #exitHandler () {
    this.#exitCode = undefined
    return once(this.worker, 'exit').then((msg) => {
      this.#exitCode = msg[0]
      return msg
    })
  }
}

module.exports = RuntimeApiClient
