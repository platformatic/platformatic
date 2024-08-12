'use strict'

const pino = require('pino')
const { printSchema } = require('graphql')

class ServiceStackable {
  constructor (options) {
    this.app = null
    this._init = options.init
    this.stackable = options.stackable

    this.configManager = options.configManager
    this.config = this.configManager.current
    this.context = options.context

    this.#updateConfig()
  }

  async init () {
    this.#initLogger()

    if (this.app === null) {
      this.app = await this._init()
    }
    return this.app
  }

  async start (options = {}) {
    await this.init()

    if (options.listen === false) {
      await this.app.ready()
      return
    }
    await this.app.start()
  }

  async stop () {
    if (this.app === null) return
    await this.app.close()
  }

  getUrl () {
    return this.app !== null ? this.app.url : null
  }

  async getInfo () {
    const type = this.stackable.configType
    const version = this.stackable.configManagerConfig.version ?? null
    return { type, version }
  }

  async getConfig () {
    const config = this.configManager.current
    const logger = config.server.logger

    if (logger) {
      config.server.logger = {}

      if (logger.level) {
        config.server.logger.level = logger.level
      }
    }

    return config
  }

  async getDispatchFunc () {
    await this.init()
    return this.app
  }

  async getOpenapiSchema () {
    await this.init()
    await this.app.ready()
    return this.app.swagger ? this.app.swagger() : null
  }

  async getGraphqlSchema () {
    await this.init()
    await this.app.ready()
    return this.app.graphql ? printSchema(this.app.graphql.schema) : null
  }

  async getMetrics ({ format }) {
    await this.init()

    const promRegister = this.app.metrics?.client?.register
    if (!promRegister) return null

    return format === 'json'
      ? promRegister.getMetricsAsJSON()
      : promRegister.metrics()
  }

  async inject (injectParams) {
    await this.init()

    const { statusCode, statusMessage, headers, body } = await this.app.inject(injectParams)
    return { statusCode, statusMessage, headers, body }
  }

  async log (options = {}) {
    await this.init()

    const logLevel = options.level ?? 'info'

    const message = options.message
    if (!message) return

    this.app.log[logLevel](message)
  }

  async getBootstrapDependencies () {
    return []
  }

  #updateConfig () {
    if (!this.context) return

    const {
      serviceId,
      telemetryConfig,
      metricsConfig,
      serverConfig,
      hasManagementApi,
      isEntrypoint,
    } = this.context

    const configManager = this.configManager

    configManager.on('error', (err) => {
      /* c8 ignore next */
      this.stackable.log({ message: 'error reloading the configuration' + err, level: 'error' })
    })

    configManager.update({
      ...configManager.current,
      telemetry: telemetryConfig,
      metrics: metricsConfig,
    })

    if (this.context.serverConfig) {
      configManager.update({
        ...configManager.current,
        server: serverConfig,
      })
    }

    if (
      (hasManagementApi && configManager.current.metrics === undefined) ||
      configManager.current.metrics
    ) {
      const labels = configManager.current.metrics?.labels || {}
      configManager.update({
        ...configManager.current,
        metrics: {
          server: 'hide',
          defaultMetrics: { enabled: isEntrypoint },
          ...configManager.current.metrics,
          labels: { serviceId, ...labels },
        },
      })
    }

    if (!isEntrypoint) {
      configManager.update({
        ...configManager.current,
        server: {
          ...(configManager.current.server || {}),
          trustProxy: true,
        },
      })
    }
  }

  #initLogger () {
    this.configManager.current.server = this.configManager.current.server || {}
    const level = this.configManager.current.server.logger?.level

    const pinoOptions = {
      level: level ?? 'trace',
    }

    if (this.context?.serviceId) {
      pinoOptions.name = this.context.serviceId
    }

    this.configManager.current.server.logger = pino(pinoOptions)
  }
}

module.exports = { ServiceStackable }
