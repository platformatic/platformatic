'use strict'

const { BaseStackable, getServerUrl, ensureTrailingSlash, cleanBasePath } = require('@platformatic/basic')
const { compile } = require('@platformatic/ts-compiler')
const { deepmerge, buildPinoFormatters, buildPinoTimestamp, features } = require('@platformatic/utils')
const fastify = require('fastify')
const { printSchema } = require('graphql')
const { randomUUID } = require('node:crypto')
const { hostname } = require('node:os')

const pino = require('pino')
const { platformaticService } = require('./application.js')
const { packageJson } = require('./schema.js')
const { sanitizeHTTPSArgument } = require('./utils.js')
const setupRoot = require('./plugins/root.js')

class ServiceStackable extends BaseStackable {
  #app
  #basePath

  constructor (options, root, configManager) {
    super('service', packageJson.version, options, root, configManager)
    this.applicationFactory = this.context.applicationFactory ?? platformaticService
  }

  async init () {
    await super.init()

    if (this.#app) {
      return
    }

    const config = this.configManager.current
    this.#basePath = ensureTrailingSlash(cleanBasePath(config.basePath ?? this.serviceId))

    // Create the application
    this.#app = fastify({
      ...this.serverConfig,
      ...this.fastifyOptions,
      genReqId () {
        return randomUUID()
      }
    })

    this.#app.decorate('platformatic', { configManager: this.configManager, config: this.configManager.current })
    await this.#app.register(this.applicationFactory, this)

    if (Array.isArray(this.context.fastifyPlugins)) {
      for (const plugin of this.context.fastifyPlugins) {
        await this.#app.register(plugin)
      }
    }

    if (!this.#app.hasRoute({ url: '/', method: 'GET' }) && !this.#app.hasRoute({ url: '/*', method: 'GET' })) {
      await this.#app.register(setupRoot)
    }
  }

  async start (startOptions) {
    // Compatibility with v2 service
    const { listen } = startOptions ?? { listen: true }

    // Make this idempotent
    if (this.url) {
      return this.url
    }

    // Create the application if needed
    if (!this.#app) {
      await this.init()
      await this.#app.ready()
    }

    if (listen) {
      await this._listen()
    }

    await this._collectMetrics()
    return this.url
  }

  async stop () {
    return this.#app?.close()
  }

  async build () {
    return compile({
      tsConfig: this.configManager.current.plugins?.typescript?.tsConfig,
      flags: this.configManager.current.plugins?.typescript?.flags,
      cwd: this.root,
      logger: this.logger
    })
  }

  async inject (injectParams, onInject) {
    const response = await this.#app.inject(injectParams, onInject)

    if (onInject) {
      return
    }

    const { statusCode, statusMessage, headers, body } = response
    return { statusCode, statusMessage, headers, body }
  }

  getApplication () {
    return this.#app
  }

  async getDispatchFunc () {
    await this.init()
    return this.#app
  }

  async getConfig () {
    const loggerInstance = this.serverConfig?.loggerInstance

    if (loggerInstance) {
      const config = Object.assign({}, this.configManager.current)
      const { loggerInstance: _, ...serverConfig } = this.serverConfig
      config.server = { ...serverConfig, logger: { level: loggerInstance.level } }

      return config
    }

    return super.getConfig()
  }

  async getWatchConfig () {
    const config = this.configManager.current

    const enabled = config.watch?.enabled !== false && config.plugins !== undefined

    if (!enabled) {
      return { enabled, path: this.root }
    }

    return {
      enabled,
      path: this.root,
      allow: config.watch?.allow,
      ignore: config.watch?.ignore
    }
  }

  getMeta () {
    return {
      composer: {
        tcp: typeof this.url !== 'undefined',
        url: this.url,
        prefix: this.basePath ?? this.#basePath,
        wantsAbsoluteUrls: false,
        needsRootTrailingSlash: false
      },
      connectionStrings: [this.connectionString]
    }
  }

  async getOpenapiSchema () {
    await this.init()
    await this.#app.ready()
    return this.#app.swagger ? this.#app.swagger() : null
  }

  async getGraphqlSchema () {
    await this.init()
    await this.#app.ready()
    return this.#app.graphql ? printSchema(this.#app.graphql.schema) : null
  }

  async updateContext (context) {
    super.updateContext(context)

    this.context = { ...this.context, ...context }

    if (!this.context) {
      return
    }

    const {
      serviceId,
      telemetryConfig,
      metricsConfig,
      serverConfig,
      hasManagementApi,
      isEntrypoint,
      isStandalone,
      isProduction,
      logger
    } = this.context

    const config = { ...this.configManager.current }

    if (telemetryConfig) {
      config.telemetry = telemetryConfig
    }
    if (metricsConfig) {
      config.metrics = metricsConfig
    }

    const loggerInstance = logger ?? serverConfig?.loggerInstance ?? this.serverConfig?.loggerInstance

    if (serverConfig) {
      config.server = deepmerge(this.serverConfig, serverConfig ?? {})
    }

    config.server ??= {}

    if ((hasManagementApi && config.metrics === undefined) || config.metrics) {
      const labels = config.metrics?.labels || {}
      config.metrics = {
        server: isStandalone ? 'own' : 'hide',
        defaultMetrics: { enabled: isEntrypoint },
        ...config.metrics,
        labels: { serviceId, ...labels }
      }
    }
    if (isProduction) {
      if (config.plugins) {
        config.plugins.typescript = false
      }
      config.watch = { enabled: false }
    }

    // Adjust server options
    if (!isEntrypoint) {
      config.server.trustProxy = true
    }

    if (config.server.https) {
      config.server.https.key = await sanitizeHTTPSArgument(config.server.https.key)
      config.server.https.cert = await sanitizeHTTPSArgument(config.server.https.cert)
    }

    // Assign the logger instance if it exists
    if (loggerInstance) {
      config.server = { ...config.server }
      config.server.loggerInstance = loggerInstance
      delete config.server.logger
    }

    this.serverConfig = config.server
    this.configManager.update(config)
  }

  _initializeLogger () {
    if (this.context?.logger) {
      return this.context.logger
    } else if (this.configManager.current.server?.loggerInstance) {
      return this.configManager.current.server?.loggerInstance
    }

    this.serverConfig ??= {}
    this.loggerConfig = deepmerge(this.context.loggerConfig ?? {}, this.serverConfig?.logger ?? {})

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

    const logger = pino(pinoOptions)

    // Only one of logger and loggerInstance should be set
    this.serverConfig.loggerInstance = logger
    delete this.serverConfig.logger

    return logger
  }

  async _listen () {
    const serverOptions = this.serverConfig
    const listenOptions = { host: serverOptions?.hostname || '127.0.0.1', port: serverOptions?.port || 0 }

    if (this.isProduction && features.node.reusePort) {
      listenOptions.reusePort = true
    }

    await this.#app.listen(listenOptions)
    this.url = getServerUrl(this.#app.server)

    if (this.serverConfig.http2 || this.serverConfig.https?.key) {
      this.url = this.url.replace('http://', 'https://')
    }

    return this.url
  }
}

module.exports = { ServiceStackable }
