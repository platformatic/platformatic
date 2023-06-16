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
    return this.#sendCommand('plt:start')
  }

  async close () {
    await this.#sendCommand('plt:stop')
    await once(this.#worker, 'exit')
  }

  async restart () {
    return this.#sendCommand('plt:restart')
  }

  async getServicesTopology () {
    return this.#sendCommand('plt:get-topology')
  }

  async getServiceStatus (id) {
    return this.#sendCommand('plt:get-status', { id })
  }

  async getServiceConfig (id) {
    return this.#sendCommand('plt:get-config', { id })
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

class RuntimeApi {
  #services
  #dispatcher

  constructor (services, dispatcher) {
    this.#services = services
    this.#dispatcher = dispatcher
  }

  async startListening (parentPort) {
    parentPort.on('message', async (message) => {
      const command = message?.command
      if (command) {
        const res = await this.#executeCommand(message)
        parentPort.postMessage(res)

        if (command === 'plt:stop') {
          process.exit() // Exit the worker thread.
        }
        return
      }
      await this.#handleProcessLevelEvent(message)
    })
  }

  async #handleProcessLevelEvent (message) {
    for (const service of this.#services.values()) {
      await service.handleProcessLevelEvent(message)
    }
  }

  async #executeCommand (message) {
    const { operationId, command, params } = message
    try {
      const res = await this.#runCommandHandler(command, params)
      return { operationId, error: null, data: JSON.stringify(res || null) }
    } catch (err) {
      return { operationId, error: err.message }
    }
  }

  async #runCommandHandler (command, params) {
    switch (command) {
      case 'plt:inject':
        return this.#inject(params)
      case 'plt:start':
        return this.#startServices(params)
      case 'plt:restart':
        return this.#restartServices(params)
      case 'plt:stop':
        return this.#stopServices(params)
      case 'plt:get-status':
        return this.#getServiceStatus(params)
      case 'plt:get-config':
        return this.#getServiceConfig(params)
      case 'plt:start-service':
        return this.#startService(params)
      case 'plt:stop-service':
        return this.#stopService(params)
      case 'plt:get-topology':
        return this.#getServicesTopology(params)
      /* c8 ignore next 2 */
      default:
        throw new Error(`Unknown Runtime API command: '${command}'`)
    }
  }

  async #inject ({ id, injectParams }) {
    const service = this.#getServiceById(id)

    const serviceStatus = service.getStatus()
    if (serviceStatus !== 'started') {
      throw new Error(`Service with id '${id}' is not started`)
    }

    const res = await service.server.inject(injectParams)
    // Return only serializable properties.
    return {
      statusCode: res.statusCode,
      statusMessage: res.statusMessage,
      headers: res.headers,
      body: res.body,
      payload: res.payload
    }
  }

  async #startServices () {
    let entrypointUrl = null
    for (const service of this.#services.values()) {
      await service.start()

      if (service.appConfig.entrypoint) {
        entrypointUrl = service.server.url
      }

      const serviceUrl = new URL(service.appConfig.localUrl)
      this.#dispatcher.route(serviceUrl.host, service.server)
    }
    return entrypointUrl
  }

  async #stopServices () {
    for (const service of this.#services.values()) {
      const serviceStatus = service.getStatus()
      if (serviceStatus === 'started') {
        await service.stop()
      }
    }
  }

  async #restartServices () {
    let entrypointUrl = null
    for (const service of this.#services.values()) {
      if (service.server) {
        await service.restart(true)
      }

      if (service.appConfig.entrypoint) {
        entrypointUrl = service.server.url
      }

      const serviceUrl = new URL(service.appConfig.localUrl)
      this.#dispatcher.route(serviceUrl.host, service.server)
    }
    return entrypointUrl
  }

  #getServiceById (id) {
    const service = this.#services.get(id)

    if (!service) {
      throw new Error(`Service with id '${id}' not found`)
    }

    return service
  }

  #getServiceStatus ({ id }) {
    const service = this.#getServiceById(id)
    return service.getStatus()
  }

  #getServiceConfig ({ id }) {
    const service = this.#getServiceById(id)

    const { config } = service
    if (!config) {
      throw new Error(`Service with id '${id}' is not started`)
    }

    return config.configManager.current
  }

  async #startService ({ id }) {
    const service = this.#getServiceById(id)
    await service.start()
  }

  async #stopService ({ id }) {
    const service = this.#getServiceById(id)
    await service.stop()
  }

  #getServicesTopology () {
    const topology = { services: [] }

    for (const app of this.#services.values()) {
      const { id, entrypoint, dependencies } = app.appConfig
      if (entrypoint) {
        topology.entrypoint = id
      }
      topology.services.push({ id, dependencies })
    }

    return topology
  }
}

module.exports = { RuntimeApi, RuntimeApiClient }
