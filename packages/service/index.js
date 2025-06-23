'use strict'

const {
  schemaOptions,
  transformConfig: basicTransformConfig,
  BaseStackable,
  getServerUrl,
  ensureTrailingSlash,
  cleanBasePath,
  resolveStackable
} = require('@platformatic/basic')
const { ConfigManager } = require('@platformatic/config')
const { telemetry } = require('@platformatic/telemetry')
const { compile } = require('@platformatic/ts-compiler')
const { deepmerge, isKeyEnabled, buildPinoFormatters, buildPinoTimestamp, features } = require('@platformatic/utils')
const fastify = require('fastify')
const { printSchema } = require('graphql')
const { randomUUID } = require('node:crypto')
const { hostname } = require('node:os')
const { readFile } = require('node:fs/promises')
const { join } = require('node:path')
const pino = require('pino')
const { Generator } = require('./lib/generator.js')
const { schema, packageJson } = require('./lib/schema.js')
const schemaComponents = require('./lib/schema.js')
const { isDocker } = require('./lib/utils.js')
const setupCors = require('./lib/plugins/cors.js')
const setupClients = require('./lib/plugins/clients.js')
const setupGraphQL = require('./lib/plugins/graphql.js')
const setupHealthCheck = require('./lib/plugins/health-check.js')
const setupMetrics = require('./lib/plugins/metrics.js')
const setupOpenAPI = require('./lib/plugins/openapi.js')
const loadPlugins = require('./lib/plugins/plugins.js')
const setupRoot = require('./lib/plugins/root.js')
const setupTsCompiler = require('./lib/plugins/typescript.js')

async function registerCriticalPlugins (app, stackable) {
  if (stackable.context.criticalPluginsRegistered) {
    return
  }

  const config = await stackable.getConfig()

  if (isKeyEnabled('metrics', config)) {
    if (config.metrics.server === 'own' && parseInt(config.server.port) === parseInt(config.metrics.port)) {
      app.log.warn('In order to serve metrics on the same port as the core applicaton, set metrics.server to "parent".')
      config.metrics.server = 'parent'
    }

    await app.register(setupMetrics, config.metrics)
  }

  // This must be done before loading the plugins, so they can inspect if the
  // openTelemetry decorator exists and then configure accordingly.
  if (isKeyEnabled('telemetry', config)) {
    await app.register(telemetry, config.telemetry)
  }

  stackable.context.criticalPluginsRegistered = true
}

async function platformaticService (app, stackable) {
  await registerCriticalPlugins(app, stackable)

  const config = await stackable.getConfig()

  // This must be done before loading the plugins, so they can be configured accordingly
  if (isKeyEnabled('clients', config)) {
    await app.register(setupClients, config.clients)
  }

  const serviceConfig = config.service || {}

  if (isKeyEnabled('openapi', serviceConfig)) {
    const openapi = serviceConfig.openapi
    await app.register(setupOpenAPI, { openapi })
  }

  if (isKeyEnabled('graphql', serviceConfig)) {
    await app.register(setupGraphQL, serviceConfig.graphql)
  }

  if (config.plugins) {
    let registerTsCompiler = false

    const typescript = config.plugins.paths && config.plugins.typescript

    /* c8 ignore next 6 */
    if (typescript === true) {
      registerTsCompiler = true
    } else if (typeof typescript === 'object') {
      registerTsCompiler = typescript.enabled === true || typescript.enabled === undefined
    }

    if (registerTsCompiler) {
      await app.register(setupTsCompiler, { context: stackable.context })
    }

    await app.register(loadPlugins, { context: stackable.context })
  }

  if (isKeyEnabled('cors', config.server)) {
    await app.register(setupCors, config.server.cors)
  }

  if (isKeyEnabled('healthCheck', config.server)) {
    await app.register(setupHealthCheck, config.server.healthCheck)
  }
}

platformaticService[Symbol.for('skip-override')] = true

class ServiceStackable extends BaseStackable {
  #app
  #basePath

  constructor (options, root, configManager) {
    super('service', packageJson.version, options, root, configManager)
    this.applicationFactory = this.context.applicationFactory ?? platformaticService
  }

  async init () {
    if (this.#app) {
      return
    }

    await this.updateContext()
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

  async start ({ listen }) {
    // Make this idempotent
    if (this.url) {
      return this.url
    }

    // Listen if entrypoint
    if (this.#app && listen) {
      await this._listen()
      return this.url
    }

    await this.init()
    await this.#app.ready()

    this.openapiSchema = this.#app.swagger ? this.#app.swagger() : null
    this.graphqlSchema = this.#app.graphql ? printSchema(this.#app.graphql.schema) : null

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
    const { statusCode, statusMessage, headers, body } = await this.#app.inject(injectParams, onInject)

    if (onInject) {
      return
    }

    return { statusCode, statusMessage, headers, body }
  }

  getApplication () {
    return this.#app
  }

  async getConfig () {
    const loggerInstance = this.configManager.current.server?.loggerInstance
    if (loggerInstance) {
      const config = Object.assign({}, this.configManager.current)
      const { loggerInstance: _, ...serverConfig } = this.serverConfig || {}
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

  async updateContext (context) {
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
      isProduction
    } = this.context

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
        server: isStandalone ? 'own' : 'hide',
        defaultMetrics: { enabled: isEntrypoint },
        ...config.metrics,
        labels: { serviceId, ...labels }
      }
    }

    if (!isEntrypoint) {
      config.server = config.server ?? {}
      config.server.trustProxy = true
    }

    if (config.server?.https) {
      config.server.https.key = await this.#sanitizeFileArg(config.server.https.key)
      config.server.https.cert = await this.#sanitizeFileArg(config.server.https.cert)
    }

    this.serverConfig = config.server || {}

    if (this.context?.logger) {
      this.serverConfig.logger = undefined
      this.serverConfig.loggerInstance = this.context.logger
    }

    if (isProduction) {
      if (config.plugins) {
        config.plugins.typescript = false
      }
      config.watch = { enabled: false }
    }

    this.configManager.update(config)
  }

  _initializeLogger () {
    if (this.context?.logger) {
      return this.context.logger
    } else if (this.configManager.current.server?.loggerInstance) {
      return this.configManager.current.server?.loggerInstance
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

    const logger = pino(pinoOptions)

    // Only one of logger and loggerInstance should be set
    delete this.configManager.current.server.logger
    this.configManager.current.server.loggerInstance = logger

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

  async #sanitizeFileArg (arg) {
    if (typeof arg === 'string') {
      return arg
    }

    if (!Array.isArray(arg)) {
      return readFile(arg.path)
    }

    // Array of strings or objects.
    for (let i = 0; i < arg.length; ++i) {
      arg[i] = await this.#sanitizeFileArg(arg[i])
    }

    return arg
  }
}

async function transformConfig () {
  await basicTransformConfig.call(this)

  if (this.current.server && (await isDocker())) {
    this.current.server.hostname = '0.0.0.0'
  }

  const typescript = this.current.plugins?.typescript

  if (typescript) {
    let { outDir, tsConfigFile } = typescript
    tsConfigFile ??= 'tsconfig.json'

    if (typeof outDir === 'undefined') {
      try {
        outDir = JSON.parse(await readFile(join(this.dirname, tsConfigFile), 'utf8')).compilerOptions.outDir
      } catch {
        // No-op
      }

      outDir ||= 'dist'
    }

    this.current.watch.ignore ??= []
    this.current.watch.ignore.push(outDir + '/**/*')
  }
}

const configManagerConfig = { schemaOptions, transformConfig }

// This will be replace by createStackable before the release of v3
async function buildStackable (opts) {
  return createStackable(opts.context.directory, opts.config, opts.context)
}

async function createStackable (fileOrDirectory, sourceOrConfig, opts, context) {
  const { root, source } = await resolveStackable(fileOrDirectory, sourceOrConfig, 'service')

  context ??= {}
  context.directory = root

  opts ??= { context }
  opts.context = context

  const configManager = new ConfigManager({ schema, source, ...configManagerConfig, dirname: root, context })
  await configManager.parseAndValidate()

  return new ServiceStackable(opts, root, configManager)
}

module.exports = {
  Generator,
  ServiceStackable,
  platformaticService,
  registerCriticalPlugins,
  createStackable,
  transformConfig,
  // Old exports
  configType: 'service',
  configManagerConfig,
  buildStackable,
  schema,
  schemaComponents,
  version: packageJson.version
}
