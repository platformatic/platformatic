'use strict'

const { hostname } = require('node:os')
const { dirname } = require('node:path')
const { pathToFileURL } = require('node:url')
const { workerData } = require('node:worker_threads')
const { printSchema } = require('graphql')
const pino = require('pino')
const { client, collectMetrics } = require('@platformatic/metrics')
const { httpMetrics } = require('@platformatic/metrics')

const { extractTypeScriptCompileOptionsFromConfig } = require('./compile')
const { compile } = require('@platformatic/ts-compiler')
const { deepmerge, buildPinoFormatters, buildPinoTimestamp } = require('@platformatic/utils')

const kITC = Symbol.for('plt.runtime.itc')

class ServiceStackable {
  constructor (options) {
    this.app = null
    this._init = options.init
    this.stackable = options.stackable
    this.metricsRegistry = new client.Registry()

    this.configManager = options.configManager
    this.context = options.context ?? {}
    this.context.stackable = this

    this.serviceId = this.context.serviceId
    this.context.worker ??= { count: 1, index: 0 }
    this.workerId = this.context.worker.count > 1 ? this.context.worker.index : undefined

    this.runtimeConfig = deepmerge(this.context.runtimeConfig ?? {}, workerData?.config ?? {})

    this.customHealthCheck = null

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
      setConnectionString: this.setConnectionString.bind(this),
      setBasePath: this.setBasePath.bind(this),
      runtimeBasePath: this.runtimeConfig?.basePath ?? null,
      invalidateHttpCache: this.#invalidateHttpCache.bind(this),
      prometheus: { client, registry: this.metricsRegistry },
      setCustomHealthCheck: this.setCustomHealthCheck.bind(this),
      setCustomReadinessCheck: this.setCustomReadinessCheck.bind(this)
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

    await compile(compileOptions)
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
      },
      connectionStrings: [this.connectionString]
    }
  }

  async getWatchConfig () {
    const config = this.configManager.current

    const enabled = config.watch?.enabled !== false && config.plugins !== undefined

    return {
      enabled,
      path: this.configManager.dirname ?? dirname(this.configManager.fullPath),
      allow: config.watch?.allow,
      ignore: config.watch?.ignore
    }
  }

  async getDispatchFunc () {
    await this.init()
    return this.app
  }

  async getDispatchTarget () {
    return this.getUrl() ?? (await this.getDispatchFunc())
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

  setCustomHealthCheck (fn) {
    this.customHealthCheck = fn
  }

  async getCustomHealthCheck () {
    if (!this.customHealthCheck) {
      return true
    }
    return await this.customHealthCheck()
  }

  setCustomReadinessCheck (fn) {
    this.customReadinessCheck = fn
  }

  async getCustomReadinessCheck () {
    if (!this.customReadinessCheck) {
      return true
    }
    return await this.customReadinessCheck()
  }

  // This method is not a part of Stackable interface because we need to register
  // fastify metrics before the server is started.
  async #collectMetrics () {
    const metricsConfig = this.context.metricsConfig

    if (metricsConfig !== false) {
      await collectMetrics(
        this.serviceId,
        this.workerId,
        {
          defaultMetrics: true,
          httpMetrics: false,
          ...metricsConfig
        },
        this.metricsRegistry
      )

      this.#setHttpMetrics()
      this.#setHttpCacheMetrics()
    }
  }

  async getMetrics ({ format }) {
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

  setConnectionString (connectionString) {
    this.connectionString = connectionString
  }

  setBasePath (basePath) {
    this.basePath = basePath
  }

  registerGlobals (globals) {
    globalThis.platformatic = Object.assign(globalThis.platformatic ?? {}, globals)
  }

  async #invalidateHttpCache (opts = {}) {
    await globalThis[kITC].send('invalidateHttpCache', opts)
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
  }

  #setHttpCacheMetrics () {
    const { client, registry } = globalThis.platformatic.prometheus

    const cacheHitMetric = new client.Counter({
      name: 'http_cache_hit_count',
      help: 'Number of http cache hits',
      registers: [registry]
    })

    const cacheMissMetric = new client.Counter({
      name: 'http_cache_miss_count',
      help: 'Number of http cache misses',
      registers: [registry]
    })

    globalThis.platformatic.onHttpCacheHit = () => {
      cacheHitMetric.inc()
    }
    globalThis.platformatic.onHttpCacheMiss = () => {
      cacheMissMetric.inc()
    }
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
      ...(this.loggerConfig ?? {}),
      level: this.loggerConfig?.level ?? 'trace'
    }

    this.registerGlobals({
      logLevel: pinoOptions.level
    })

    if (this.context?.serviceId) {
      pinoOptions.name = this.context.serviceId
    }

    if (this.context?.worker?.count > 1 && this.loggerConfig?.base !== null) {
      pinoOptions.base = { pid: process.pid, hostname: hostname(), worker: this.context.worker.index }
    } else if (this.loggerConfig?.base === null) {
      pinoOptions.base = undefined
    }

    if (this.loggerConfig?.formatters) {
      pinoOptions.formatters = buildPinoFormatters(this.loggerConfig?.formatters)
    }
    if (this.loggerConfig?.timestamp) {
      pinoOptions.timestamp = buildPinoTimestamp(this.loggerConfig?.timestamp)
    }

    this.logger = pino(pinoOptions)

    // Only one of logger and loggerInstance should be set
    delete this.configManager.current.server.logger
    this.configManager.current.server.loggerInstance = this.logger
  }
}

module.exports = { ServiceStackable }
