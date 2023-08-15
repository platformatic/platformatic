'use strict'

const FastifyUndiciDispatcher = require('fastify-undici-dispatcher')
const { Agent, setGlobalDispatcher } = require('undici')
const { PlatformaticApp } = require('./app')

class RuntimeApi {
  #services
  #dispatcher

  constructor (config, logger, loaderPort) {
    this.#services = new Map()
    const telemetryConfig = config.telemetry

    for (let i = 0; i < config.services.length; ++i) {
      const service = config.services[i]
      const serviceTelemetryConfig = telemetryConfig ? { ...telemetryConfig, serviceName: `${telemetryConfig.serviceName}-${service.id}` } : null
      const app = new PlatformaticApp(service, loaderPort, logger, serviceTelemetryConfig)

      this.#services.set(service.id, app)
    }

    const globalAgent = new Agent()
    const globalDispatcher = new FastifyUndiciDispatcher({
      dispatcher: globalAgent,
      // setting the domain here allows for fail-fast scenarios
      domain: '.plt.local'
    })

    setGlobalDispatcher(globalDispatcher)
    this.#dispatcher = globalDispatcher
  }

  async startListening (parentPort) {
    parentPort.on('message', async (message) => {
      const command = message?.command
      if (command) {
        const res = await this.#executeCommand(message)
        parentPort.postMessage(res)

        if (command === 'plt:stop-services') {
          process.exit() // Exit the worker thread.
        }
        return
      }
      await this.#handleProcessLevelEvent(message)
    })
  }

  async #handleProcessLevelEvent (message) {
    const services = [...this.#services.values()]
    await Promise.allSettled(services.map(async (service) => {
      await service.handleProcessLevelEvent(message)
    }))

    for (const service of services) {
      if (service.getStatus() === 'started') {
        return
      }
    }

    process.exit() // Exit the worker thread if all services are stopped
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
      case 'plt:start-services':
        return this.startServices(params)
      case 'plt:stop-services':
        return this.stopServices(params)
      case 'plt:restart-services':
        return this.#restartServices(params)
      case 'plt:get-services':
        return this.#getServices(params)
      case 'plt:get-service-details':
        return this.#getServiceDetails(params)
      case 'plt:get-service-config':
        return this.#getServiceConfig(params)
      case 'plt:get-service-openapi-schema':
        return this.#getServiceOpenapiSchema(params)
      case 'plt:start-service':
        return this.#startService(params)
      case 'plt:stop-service':
        return this.#stopService(params)
      case 'plt:inject':
        return this.#inject(params)
      /* c8 ignore next 2 */
      default:
        throw new Error(`Unknown Runtime API command: '${command}'`)
    }
  }

  async startServices () {
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

  async stopServices () {
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

  #getServices () {
    const services = { services: [] }

    for (const service of this.#services.values()) {
      const serviceId = service.appConfig.id
      const serviceDetails = this.#getServiceDetails({ id: serviceId })
      if (serviceDetails.entrypoint) {
        services.entrypoint = serviceId
      }
      services.services.push(serviceDetails)
    }

    return services
  }

  #getServiceById (id) {
    const service = this.#services.get(id)

    if (!service) {
      throw new Error(`Service with id '${id}' not found`)
    }

    return service
  }

  #getServiceDetails ({ id }) {
    const service = this.#getServiceById(id)
    const status = service.getStatus()

    const { entrypoint, dependencies, localUrl } = service.appConfig
    return { id, status, localUrl, entrypoint, dependencies }
  }

  #getServiceConfig ({ id }) {
    const service = this.#getServiceById(id)

    const { config } = service
    if (!config) {
      throw new Error(`Service with id '${id}' is not started`)
    }

    return config.configManager.current
  }

  async #getServiceOpenapiSchema ({ id }) {
    const service = this.#getServiceById(id)

    if (!service.config) {
      throw new Error(`Service with id '${id}' is not started`)
    }

    const { configManager, configType } = service.config
    const config = configManager.current

    let openapiConfig = null
    switch (configType) {
      case 'service':
      case 'composer':
        openapiConfig = config.service?.openapi
        break
      case 'db':
        openapiConfig = config.db?.openapi
        break
      default:
        throw new Error(`Unknown config type: '${configType}'`)
    }

    if (!openapiConfig) {
      throw new Error(`Service with id '${id}' does not expose an OpenAPI schema`)
    }

    const openapiPath = '/documentation/json'

    const { statusCode, body } = await service.server.inject({
      method: 'GET',
      url: openapiPath
    })

    if (statusCode !== 200) {
      throw new Error(`Failed to retrieve OpenAPI schema for service with id '${id}'`)
    }

    const openapiSchema = JSON.parse(body)
    return openapiSchema
  }

  async #startService ({ id }) {
    const service = this.#getServiceById(id)
    await service.start()
  }

  async #stopService ({ id }) {
    const service = this.#getServiceById(id)
    await service.stop()
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
}

module.exports = RuntimeApi
