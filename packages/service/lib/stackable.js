'use strict'

const { dirname } = require('node:path')
const { printSchema } = require('graphql')
const pino = require('pino')
const httpMetrics = require('@platformatic/fastify-http-metrics')
const { executeCommand } = require('@platformatic/utils')

class ServiceStackable {
  constructor (options) {
    this.app = null
    this._init = options.init
    this.stackable = options.stackable
    this.metricsRegistry = null

    this.configManager = options.configManager
    this.context = options.context ?? {}
    this.context.stackable = this

    this.configManager.on('error', err => {
      /* c8 ignore next */
      this.stackable.log({
        message: 'error reloading the configuration' + err,
        level: 'error'
      })
    })

    this.#updateConfig()
  }

  async init () {
    this.#initLogger()

    if (this.app === null) {
      this.app = await this._init()

      if (this.metricsRegistry) {
        this.#setHttpMetrics()
      }
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

  async build () {
    // We don't use this.app.log as the app has not being initialized.
    const logger = globalThis.platformatic.logger

    logger.debug("Executing 'platformatic compile' ...")

    const { exitCode } = await executeCommand(
      this.context.directory,
      'platformatic compile',
      logger,
      'Compilation failed with exit code {EXIT_CODE}'
    )

    if (exitCode !== 0) {
      throw new Error(`Building failed with exit code ${exitCode}`)
    }
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

  async getWatchConfig () {
    const config = this.configManager.current

    const enabled = config.watch?.enabled !== false && config.plugins !== undefined

    return {
      enabled,
      path: dirname(this.configManager.fullPath),
      allow: config.watch?.allow,
      ignore: config.watch?.ignore
    }
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

  async collectMetrics ({ registry }) {
    this.metricsRegistry = registry

    return {
      defaultMetrics: true,
      httpMetrics: false
    }
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

  async updateContext (context) {
    this.context = { ...this.context, ...context }
    this.#updateConfig()
  }

  #setHttpMetrics () {
    this.app.register(httpMetrics, {
      registry: this.metricsRegistry,
      customLabels: ['telemetry_id'],
      getCustomLabels: req => {
        const telemetryId = req.headers['x-plt-telemetry-id'] ?? 'unknown'
        return { telemetry_id: telemetryId }
      }
    })

    this.app.register(httpMetrics, {
      registry: this.metricsRegistry,
      customLabels: ['telemetry_id'],
      getCustomLabels: req => {
        const telemetryId = req.headers['x-plt-telemetry-id'] ?? 'unknown'
        return { telemetry_id: telemetryId }
      },
      histogram: {
        name: 'http_request_all_duration_seconds',
        help: 'request duration in seconds summary for all requests',
        collect: function () {
          process.nextTick(() => this.reset())
        }
      },
      summary: {
        name: 'http_request_all_summary_seconds',
        help: 'request duration in seconds histogram for all requests',
        collect: function () {
          process.nextTick(() => this.reset())
        }
      }
    })
  }

  #updateConfig () {
    if (!this.context) return

    const { serviceId, telemetryConfig, metricsConfig, serverConfig, hasManagementApi, isEntrypoint, isProduction } =
      this.context

    const config = this.configManager.current

    if (telemetryConfig) {
      config.telemetry = telemetryConfig
    }
    if (metricsConfig) {
      config.metrics = metricsConfig
    }
    if (serverConfig) {
      config.server = serverConfig
    }

    if ((hasManagementApi && config.metrics === undefined) || config.metrics) {
      const labels = config.metrics?.labels || {}
      config.metrics = {
        server: 'hide',
        defaultMetrics: { enabled: isEntrypoint },
        ...config.metrics,
        labels: { serviceId, ...labels }
      }
    }

    if (!isEntrypoint) {
      config.server = config.server ?? {}
      config.server.trustProxy = true
    }

    if (isProduction) {
      if (config.plugins) {
        config.plugins.typescript = false
      }
      config.watch = { enabled: false }
    }

    this.configManager.update(config)
  }

  #initLogger () {
    this.configManager.current.server = this.configManager.current.server || {}
    const level = this.configManager.current.server.logger?.level

    const pinoOptions = {
      level: level ?? 'trace'
    }

    if (this.context?.serviceId) {
      pinoOptions.name = this.context.serviceId
    }

    this.configManager.current.server.logger = pino(pinoOptions)
  }
}

module.exports = { ServiceStackable }
