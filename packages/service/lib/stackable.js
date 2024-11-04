'use strict'

const { hostname } = require('node:os')
const { dirname } = require('node:path')
const { pathToFileURL } = require('node:url')
const { workerData } = require('node:worker_threads')
const { printSchema } = require('graphql')
const pino = require('pino')
const { collectMetrics } = require('@platformatic/metrics')
const httpMetrics = require('@platformatic/fastify-http-metrics')
const { extractTypeScriptCompileOptionsFromConfig } = require('./compile')
const { compile } = require('@platformatic/ts-compiler')
const { deepmerge } = require('@platformatic/utils')

class ServiceStackable {
  constructor (options) {
    this.app = null
    this._init = options.init
    this.stackable = options.stackable
    this.metricsRegistry = null

    this.configManager = options.configManager
    this.context = options.context ?? {}
    this.context.stackable = this

    this.serviceId = this.context.serviceId
    this.context.worker ??= { count: 1, index: 0 }
    this.workerId = this.context.worker.count > 1 ? this.context.worker.index : undefined

    this.runtimeConfig = deepmerge(
      this.context.runtimeConfig ?? {},
      workerData?.config ?? {}
    )

    this.configManager.on('error', err => {
      /* c8 ignore next */
      this.stackable.log({
        message: 'error reloading the configuration' + err,
        level: 'error'
      })
    })

    this.#updateConfig()

    // Setup globals
    this.registerGlobals({
      serviceId: this.serviceId,
      workerId: this.workerId,
      // Always use URL to avoid serialization problem in Windows
      root: this.context.directory ? pathToFileURL(this.context.directory).toString() : undefined,
      setOpenapiSchema: this.setOpenapiSchema.bind(this),
      setGraphqlSchema: this.setGraphqlSchema.bind(this),
      setBasePath: this.setBasePath.bind(this),
      runtimeBasePath: this.runtimeConfig?.basePath ?? null
    })
  }

  async init () {
    this.#initLogger()

    if (this.app === null) {
      this.app = await this._init()
      await this.#collectMetrics()
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

  async getEnv () {
    return this.configManager.env
  }

  getMeta () {
    const config = this.configManager.current

    return {
      composer: {
        prefix: config.basePath ?? this.basePath ?? this.context?.serviceId,
        wantsAbsoluteUrls: false,
        needsRootRedirect: false,
        tcp: !!this.app?.url,
        url: this.app?.url
      }
    }
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

  // This method is not a part of Stackable interface because we need to register
  // fastify metrics before the server is started.
  async #collectMetrics () {
    const metricsConfig = this.context.metricsConfig

    if (metricsConfig !== false) {
      const { registry } = await collectMetrics(this.context.serviceId, this.context.worker.index, {
        defaultMetrics: true,
        httpMetrics: false,
        ...metricsConfig
      })
      this.metricsRegistry = registry
      this.#setHttpMetrics()
    }
  }

  async getMetrics ({ format }) {
    if (!this.metricsRegistry) return null

    return format === 'json' ? await this.metricsRegistry.getMetricsAsJSON() : await this.metricsRegistry.metrics()
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

  setOpenapiSchema (schema) {
    this.openapiSchema = schema
  }

  setGraphqlSchema (schema) {
    this.graphqlSchema = schema
  }

  setBasePath (basePath) {
    this.basePath = basePath
  }

  registerGlobals (globals) {
    globalThis.platformatic = Object.assign(globalThis.platformatic ?? {}, globals)
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
      config.server = deepmerge(config.server ?? {}, serverConfig ?? {})
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
    if (this.configManager.current.server?.loggerInstance) {
      this.logger = this.configManager.current.server?.loggerInstance
      return
    }

    this.configManager.current.server ??= {}
    this.loggerConfig = deepmerge(this.context.loggerConfig ?? {}, this.configManager.current.server?.logger ?? {})

    const pinoOptions = {
      level: this.loggerConfig?.level ?? 'trace'
    }

    this.registerGlobals({
      logLevel: pinoOptions.level
    })

    if (this.context?.serviceId) {
      pinoOptions.name = this.context.serviceId
    }

    if (typeof this.context?.worker?.index !== 'undefined') {
      pinoOptions.base = { pid: process.pid, hostname: hostname(), worker: this.context.worker.index }
    }

    this.logger = pino(pinoOptions)

    // Only one of logger and loggerInstance should be set
    delete this.configManager.current.server.logger
    this.configManager.current.server.loggerInstance = this.logger
  }
}

module.exports = { ServiceStackable }
