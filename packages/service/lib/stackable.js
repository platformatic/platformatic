'use strict'

const { dirname } = require('node:path')
const { printSchema } = require('graphql')
const pino = require('pino')
const httpMetrics = require('@platformatic/fastify-http-metrics')
const { extractTypeScriptCompileOptionsFromConfig } = require('./compile')
const { compile } = require('@platformatic/ts-compiler')

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
    this.#initLogger()
    const typeScriptCompileOptions = extractTypeScriptCompileOptionsFromConfig(this.configManager.current)
    const cwd = dirname(this.configManager.fullPath)
    const compileOptions = {
      ...typeScriptCompileOptions,
      cwd,
      logger: this.logger
    }
    if (!(await compile(compileOptions))) {
      throw new Error(`Failed to compile ${cwd}`)
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
    const config = Object.assign({}, this.configManager.current)
    config.server = Object.assign({}, config.server)
    const logger = config.server.loggerInstance

    if (logger) {
      config.server.logger = {}

      if (logger.level) {
        config.server.logger.level = logger.level
      }
    }

    delete config.server.loggerInstance

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
    this.configManager.current.server ??= {}
    this.loggerConfig = this.configManager.current.server.logger ?? this.context.loggerConfig

    const pinoOptions = {
      level: this.loggerConfig?.level ?? 'trace'
    }

    if (this.context?.serviceId) {
      pinoOptions.name = this.context.serviceId
    }

    this.logger = pino(pinoOptions)

    // Only one of logger and loggerInstance should be set
    delete this.configManager.current.server.logger
    this.configManager.current.server.loggerInstance = this.logger
  }
}

module.exports = { ServiceStackable }
