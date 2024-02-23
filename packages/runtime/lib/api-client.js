'use strict'

const { once, EventEmitter } = require('node:events')
const { randomUUID } = require('node:crypto')
const errors = require('./errors')
const { setTimeout: sleep } = require('node:timers/promises')

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

    this.worker.postMessage({ command: 'plt:close' })
    const res = await Promise.race([
      this.#exitPromise,
      // We must kill the worker if it doesn't exit in 10 seconds
      // because it may be stuck in an infinite loop.
      // This is a workaround for
      // https://github.com/nodejs/node/issues/47748
      // https://github.com/nodejs/node/issues/49344
      // Remove once https://github.com/nodejs/node/pull/51290 is released
      // on all lines.
      // Likely to be removed when we drop support for Node.js 18.
      sleep(10000, 'timeout', { ref: false })
    ])

    if (res === 'timeout') {
      this.worker.unref()
    }
  }

  async restart () {
    return this.#sendCommand('plt:restart-services')
  }

  async getEntrypointDetails () {
    return this.#sendCommand('plt:get-entrypoint-details')
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

  async getServiceGraphqlSchema (id) {
    return this.#sendCommand('plt:get-service-graphql-schema', { id })
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
