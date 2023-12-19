'use strict'

const FastifyUndiciDispatcher = require('fastify-undici-dispatcher')
const { setGlobalDispatcher, getGlobalDispatcher } = require('undici')
const { PlatformaticApp } = require('./app')
const errors = require('./errors')
const { printSchema } = require('graphql')

const { setTimeout } = require('timers/promises')

class RuntimeApi {
  #services
  #dispatcher

  constructor (config, logger, loaderPort) {
    this.#services = new Map()
    const telemetryConfig = config.telemetry

    for (let i = 0; i < config.services.length; ++i) {
      const service = config.services[i]
      const serviceTelemetryConfig = telemetryConfig ? { ...telemetryConfig, serviceName: `${telemetryConfig.serviceName}-${service.id}` } : null

      // If the service is an entrypoint and runtime server config is defined, use it.
      let serverConfig = null
      if (config.server && service.entrypoint) {
        serverConfig = config.server
      } else if (service.useHttp) {
        serverConfig = {
          port: 0,
          host: '127.0.0.1',
          keepAliveTimeout: 5000
        }
      }
      const app = new PlatformaticApp(service, loaderPort, logger, serviceTelemetryConfig, serverConfig)

      this.#services.set(service.id, app)
    }

    const globalAgent = getGlobalDispatcher()
    const globalDispatcher = new FastifyUndiciDispatcher({
      dispatcher: globalAgent,
      // setting the domain here allows for fail-fast scenarios
      domain: '.plt.local'
    })

    setGlobalDispatcher(globalDispatcher)
    this.#dispatcher = globalDispatcher

    process.on('SIGINT', async () => {
      console.log('closing dispatcher on SIGINT')
      await this.#dispatcher.close()
      console.log('closed dispatcher on SIGINT')
    })
  }

  async startListening (parentPort) {
    parentPort.on('message', async (message) => {
      const command = message?.command
      if (command) {
        console.log('worker received a request', message)
        const res = await this.#executeCommand(message)
        console.log('worker sends a response', res)
        parentPort.postMessage(res)

        if (command === 'plt:stop-services') {
          console.log('terminate worker thread')
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

    if (this.#dispatcher) {
      console.log('closing dispatcher in handleProcessLevelEvent')
      await this.#dispatcher.close()
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
      case 'plt:get-service-graphql-schema':
        return this.#getServiceGraphqlSchema(params)
      case 'plt:start-service':
        return this.#startService(params)
      case 'plt:stop-service':
        return this.#stopService(params)
      case 'plt:inject':
        return this.#inject(params)
      /* c8 ignore next 2 */
      default:
        throw new errors.UnknownRuntimeAPICommandError(command)
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
    console.log('call stopServices handler')
    const stopServiceReqs = [this.#dispatcher.close()]
    for (const service of this.#services.values()) {
      console.log('stopServices', service.appConfig.id)
      const serviceStatus = service.getStatus()
      if (serviceStatus === 'started') {
        stopServiceReqs.push(service.stop().then(() => {
          console.log('stopServices', service.appConfig.id, 'stopped')
        }))
      }
    }
    await Promise.all(stopServiceReqs)
    await setTimeout(500)
    console.log('stopServices', 'all stopped')
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
      throw new errors.ServiceNotFoundError(id)
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
      throw new errors.ServiceNotStartedError(id)
    }

    return config.configManager.current
  }

  async #getServiceOpenapiSchema ({ id }) {
    const service = this.#getServiceById(id)

    if (!service.config) {
      throw new errors.ServiceNotStartedError(id)
    }

    if (typeof service.server.swagger !== 'function') {
      return null
    }

    try {
      await service.server.ready()
      const openapiSchema = service.server.swagger()
      return openapiSchema
    } catch (err) {
      throw new errors.FailedToRetrieveOpenAPISchemaError(id, err.message)
    }
  }

  async #getServiceGraphqlSchema ({ id }) {
    const service = this.#getServiceById(id)

    if (!service.config) {
      throw new errors.ServiceNotStartedError(id)
    }

    if (typeof service.server.graphql !== 'function') {
      return null
    }

    try {
      await service.server.ready()
      const graphqlSchema = printSchema(service.server.graphql.schema)
      return graphqlSchema
    } catch (err) {
      throw new errors.FailedToRetrieveGraphQLSchemaError(id, err.message)
    }
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
      throw new errors.ServiceNotStartedError(id)
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
