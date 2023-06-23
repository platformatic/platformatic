'use strict'

const { once, EventEmitter } = require('node:events')
const { randomUUID } = require('node:crypto')

const MAX_LISTENERS_COUNT = 100

class RuntimeApiClient extends EventEmitter {
  #worker

  constructor (worker) {
    super()
    this.setMaxListeners(MAX_LISTENERS_COUNT)

    this.#worker = worker
    this.#worker.on('message', (message) => {
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
    await once(this.#worker, 'exit')
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

    this.#worker.postMessage({ operationId, command, params })
    const [message] = await once(this, operationId)

    const { error, data } = message
    if (error !== null) {
      throw new Error(error)
    }

    return JSON.parse(data)
  }
}

module.exports = RuntimeApiClient
