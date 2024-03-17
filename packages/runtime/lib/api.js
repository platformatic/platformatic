'use strict'

const { getGlobalDispatcher, setGlobalDispatcher } = require('undici')
const { createFastifyInterceptor } = require('fastify-undici-dispatcher')
const { PlatformaticApp } = require('./app')
const errors = require('./errors')
const { printSchema } = require('graphql')

class RuntimeApi {
  #services
  #dispatcher
  #interceptor
  #logger

  constructor (config, logger, loaderPort, composedInterceptors = []) {
    this.#services = new Map()
    this.#logger = logger
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

      const app = new PlatformaticApp(service, loaderPort, logger, serviceTelemetryConfig, serverConfig, !!config.managementApi)

      this.#services.set(service.id, app)
    }

    this.#interceptor = createFastifyInterceptor({
      // setting the domain here allows for fail-fast scenarios
      domain: '.plt.local'
    })

    composedInterceptors.unshift(this.#interceptor)

    this.#dispatcher = getGlobalDispatcher().compose(composedInterceptors)
    setGlobalDispatcher(this.#dispatcher)
  }

  async startListening (parentPort) {
    parentPort.on('message', async (message) => {
      const command = message?.command
      if (command) {
        if (command === 'plt:close') {
          // We close everything because they might be using
          // a FinalizationRegistry and it may stuck us in an infinite loop.
          // This is a workaround for
          // https://github.com/nodejs/node/issues/47748
          // https://github.com/nodejs/node/issues/49344
          // Remove once https://github.com/nodejs/node/pull/51290 is released
          // on all lines.
          // Likely to be removed when we drop support for Node.js 18.
          if (this.#dispatcher) {
            await this.#dispatcher.close()
          }
          setImmediate(process.exit) // Exit the worker thread.
          return
        }

        const res = await this.#executeCommand(message)
        parentPort.postMessage(res)
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
      case 'plt:get-entrypoint-details':
        return this.#getEntrypointDetails(params)
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
      case 'plt:get-metrics':
        return this.#getMetrics(params)
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
      this.#interceptor.route(serviceUrl.host, service.server)
    }
    return entrypointUrl
  }

  async stopServices () {
    const stopServiceReqs = []
    for (const service of this.#services.values()) {
      const serviceStatus = service.getStatus()
      if (serviceStatus === 'started') {
        stopServiceReqs.push(service.stop())
      }
    }
    await Promise.all(stopServiceReqs)
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
      this.#interceptor.route(serviceUrl.host, service.server)
    }
    return entrypointUrl
  }

  #getEntrypointDetails () {
    for (const service of this.#services.values()) {
      if (service.appConfig.entrypoint) {
        return this.#getServiceDetails({ id: service.appConfig.id })
      }
    }
    return null
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
      const listOfServices = this.#getServices().services.map(svc => svc.id).join(', ')
      throw new errors.ServiceNotFoundError(listOfServices)
    }

    return service
  }

  #getServiceDetails ({ id }) {
    const service = this.#getServiceById(id)
    const status = service.getStatus()

    const type = service.config?.configType
    const { entrypoint, dependencies, localUrl } = service.appConfig
    const serviceDetails = { id, type, status, localUrl, entrypoint, dependencies }

    if (entrypoint) {
      serviceDetails.url = status === 'started' ? service.server.url : null
    }

    return serviceDetails
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

  async #getMetrics ({ format }) {
    let entrypoint = null
    for (const service of this.#services.values()) {
      if (service.appConfig.entrypoint) {
        entrypoint = service
        break
      }
    }

    if (!entrypoint.config) {
      throw new errors.ServiceNotStartedError(entrypoint.id)
    }

    const promRegister = entrypoint.server.metrics?.client?.register
    if (!promRegister) {
      return null
    }

    // All runtime services shares the same metrics registry.
    // Getting metrics from the entrypoint returns all metrics.
    const metrics = format === 'json'
      ? await promRegister.getMetricsAsJSON()
      : await promRegister.metrics()

    return { metrics }
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
      body: res.body
    }
  }
}

module.exports = RuntimeApi
