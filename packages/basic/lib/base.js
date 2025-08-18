import { buildPinoOptions, deepmerge, executeWithTimeout, kMetadata, kTimeout } from '@platformatic/foundation'
import { client, collectMetrics, ensureMetricsGroup } from '@platformatic/metrics'
import { parseCommandString } from 'execa'
import { spawn } from 'node:child_process'
import EventEmitter, { once } from 'node:events'
import { existsSync } from 'node:fs'
import { platform } from 'node:os'
import { pathToFileURL } from 'node:url'
import { workerData } from 'node:worker_threads'
import pino from 'pino'
import { NonZeroExitCode } from './errors.js'
import { cleanBasePath } from './utils.js'
import { ChildManager } from './worker/child-manager.js'
const kITC = Symbol.for('plt.runtime.itc')

export class BaseCapability extends EventEmitter {
  childManager
  subprocess
  subprocessForceClose
  subprocessTerminationSignal
  #subprocessStarted
  #metricsCollected

  constructor (type, version, root, config, context, standardStreams = {}) {
    super()

    this.type = type
    this.version = version
    this.root = root
    this.config = config
    this.context = context ?? {}
    this.context.worker ??= { count: 1, index: 0 }
    this.standardStreams = standardStreams

    this.serviceId = this.context.serviceId
    this.workerId = this.context.worker.count > 1 ? this.context.worker.index : undefined
    this.telemetryConfig = this.context.telemetryConfig
    this.serverConfig = deepmerge(this.context.serverConfig ?? {}, config.server ?? {})
    this.openapiSchema = null
    this.graphqlSchema = null
    this.connectionString = null
    this.basePath = null
    this.isEntrypoint = this.context.isEntrypoint
    this.isProduction = this.context.isProduction
    this.#metricsCollected = false
    this.customHealthCheck = null
    this.customReadinessCheck = null
    this.clientWs = null
    this.runtimeConfig = deepmerge(this.context?.runtimeConfig ?? {}, workerData?.config ?? {})
    this.stdout = standardStreams?.stdout ?? process.stdout
    this.stderr = standardStreams?.stderr ?? process.stderr
    this.subprocessForceClose = false
    this.subprocessTerminationSignal = 'SIGINT'

    this.logger = this._initializeLogger()

    // Setup globals
    this.registerGlobals({
      serviceId: this.serviceId,
      workerId: this.workerId,
      logLevel: this.logger.level,
      // Always use URL to avoid serialization problem in Windows
      root: pathToFileURL(this.root).toString(),
      setOpenapiSchema: this.setOpenapiSchema.bind(this),
      setGraphqlSchema: this.setGraphqlSchema.bind(this),
      setConnectionString: this.setConnectionString.bind(this),
      setBasePath: this.setBasePath.bind(this),
      runtimeBasePath: this.runtimeConfig?.basePath ?? null,
      invalidateHttpCache: this.#invalidateHttpCache.bind(this),
      setCustomHealthCheck: this.setCustomHealthCheck.bind(this),
      setCustomReadinessCheck: this.setCustomReadinessCheck.bind(this),
      notifyConfig: this.notifyConfig.bind(this),
      logger: this.logger
    })

    if (globalThis.platformatic.prometheus) {
      this.metricsRegistry = globalThis.platformatic.prometheus.registry
    } else {
      this.metricsRegistry = new client.Registry()
      this.registerGlobals({ prometheus: { client, registry: this.metricsRegistry } })
    }
  }

  init () {
    return this.updateContext()
  }

  updateContext (_context) {
    // No-op by default
  }

  start () {
    throw new Error('BaseCapability.start must be overriden by the subclasses')
  }

  stop () {
    throw new Error('BaseCapability.stop must be overriden by the subclasses')
  }

  build () {
    // No-op by default
  }

  // Alias for stop
  close () {
    return this.stop()
  }

  inject () {
    throw new Error('BaseCapability.inject must be overriden by the subclasses')
  }

  getUrl () {
    return this.url
  }

  async getConfig (includeMeta = false) {
    if (includeMeta) {
      return this.config
    }

    const { [kMetadata]: _, ...config } = this.config
    return config
  }

  async getEnv () {
    return this.config[kMetadata].env
  }

  async getWatchConfig () {
    const config = this.config

    const enabled = config.watch?.enabled !== false

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

  async getInfo () {
    return { type: this.type, version: this.version }
  }

  getDispatchFunc () {
    return this
  }

  async getDispatchTarget () {
    return this.getUrl() ?? (await this.getDispatchFunc())
  }

  getMeta () {
    return {
      composer: {
        wantsAbsoluteUrls: false
      }
    }
  }

  async getMetrics ({ format } = {}) {
    if (this.childManager && this.clientWs) {
      return this.childManager.send(this.clientWs, 'getMetrics', { format })
    }

    return format === 'json' ? await this.metricsRegistry.getMetricsAsJSON() : await this.metricsRegistry.metrics()
  }

  async getOpenapiSchema () {
    return this.openapiSchema
  }

  async getGraphqlSchema () {
    return this.graphqlSchema
  }

  setOpenapiSchema (schema) {
    this.openapiSchema = schema
  }

  setGraphqlSchema (schema) {
    this.graphqlSchema = schema
  }

  setCustomHealthCheck (fn) {
    this.customHealthCheck = fn
  }

  setCustomReadinessCheck (fn) {
    this.customReadinessCheck = fn
  }

  async getCustomHealthCheck () {
    if (!this.customHealthCheck) {
      return true
    }
    return await this.customHealthCheck()
  }

  async getCustomReadinessCheck () {
    if (!this.customReadinessCheck) {
      return true
    }
    return await this.customReadinessCheck()
  }

  setConnectionString (connectionString) {
    this.connectionString = connectionString
  }

  setBasePath (basePath) {
    this.basePath = basePath
  }

  async log ({ message, level }) {
    const logLevel = level ?? 'info'
    this.logger[logLevel](message)
  }

  registerGlobals (globals) {
    globalThis.platformatic = Object.assign(globalThis.platformatic ?? {}, globals)
  }

  verifyOutputDirectory (path) {
    if (this.isProduction && !existsSync(path)) {
      throw new Error(
        `Cannot access directory '${path}'. Please run the 'build' command before running in production mode.`
      )
    }
  }

  async buildWithCommand (command, basePath, opts = {}) {
    const { loader, scripts, context, disableChildManager } = opts

    if (Array.isArray(command)) {
      command = command.join(' ')
    }

    this.logger.debug(`Executing "${command}" ...`)

    const baseContext = await this.getChildManagerContext(basePath)
    this.childManager = disableChildManager
      ? null
      : new ChildManager({
        logger: this.logger,
        loader,
        scripts,
        context: { ...baseContext, isBuilding: true, ...context }
      })

    try {
      await this.childManager?.inject()

      const subprocess = await this.spawn(command)
      const [exitCode] = await once(subprocess, 'exit')

      if (exitCode !== 0) {
        const error = new NonZeroExitCode(exitCode)
        error.exitCode = exitCode
        throw error
      }
    } finally {
      await this.childManager?.eject()
      await this.childManager?.close()
    }
  }

  async startWithCommand (command, loader, scripts) {
    const config = this.config
    const basePath = config.application?.basePath ? cleanBasePath(config.application?.basePath) : ''

    const context = await this.getChildManagerContext(basePath)
    this.childManager = new ChildManager({
      logger: this.logger,
      loader,
      context,
      scripts
    })

    this.childManager.on('config', config => {
      this.subprocessConfig = config
      this.notifyConfig(config)
    })

    this.childManager.on('connectionString', connectionString => {
      this.connectionString = connectionString
    })

    this.childManager.on('openapiSchema', schema => {
      this.openapiSchema = schema
    })

    this.childManager.on('graphqlSchema', schema => {
      this.graphqlSchema = schema
    })

    this.childManager.on('basePath', path => {
      this.basePath = path
    })

    // This is not really important for the URL but sometimes it also a sign
    // that the process has been replaced and thus we need to update the client WebSocket
    this.childManager.on('url', (url, clientWs) => {
      this.url = url
      this.clientWs = clientWs
    })

    try {
      await this.childManager.inject()
      this.subprocess = await this.spawn(command)
      this.#subprocessStarted = true
    } catch (e) {
      this.childManager.close()
      throw new Error(`Cannot execute command "${command}": executable not found`)
    } finally {
      await this.childManager.eject()
    }

    // If the process exits prematurely, terminate the thread with the same code
    this.subprocess.on('exit', code => {
      if (this.#subprocessStarted && typeof code === 'number' && code !== 0) {
        this.childManager.close()
        process.exit(code)
      }
    })

    const [url, clientWs] = await once(this.childManager, 'url')
    this.url = url
    this.clientWs = clientWs

    await this._collectMetrics()
  }

  async stopCommand () {
    const exitTimeout = this.runtimeConfig.gracefulShutdown.service

    this.#subprocessStarted = false
    const exitPromise = once(this.subprocess, 'exit')

    // Attempt graceful close on the process
    const handled = await this.childManager.send(this.clientWs, 'close', this.subprocessTerminationSignal)

    if (!handled && this.subprocessForceClose) {
      this.subprocess.kill(this.subprocessTerminationSignal)
    }

    // If the process hasn't exited in X seconds, kill it in the polite way
    /* c8 ignore next 10 */
    const res = await executeWithTimeout(exitPromise, exitTimeout)

    if (res === kTimeout) {
      this.subprocess.kill(this.subprocessTerminationSignal)

      // If the process hasn't exited in X seconds, kill it the hard way
      const res = await executeWithTimeout(exitPromise, exitTimeout)
      if (res === kTimeout) {
        this.subprocess.kill('SIGKILL')
      }
    }

    await exitPromise

    // Close the manager
    await this.childManager.close()
  }

  getChildManager () {
    return this.childManager
  }

  async getChildManagerContext (basePath) {
    const meta = await this.getMeta()

    return {
      id: this.id,
      config: this.config,
      serviceId: this.serviceId,
      workerId: this.workerId,
      // Always use URL to avoid serialization problem in Windows
      root: pathToFileURL(this.root).toString(),
      basePath,
      logLevel: this.logger.level,
      isEntrypoint: this.isEntrypoint,
      runtimeBasePath: this.runtimeConfig?.basePath ?? null,
      wantsAbsoluteUrls: meta.composer?.wantsAbsoluteUrls ?? false,
      /* c8 ignore next 2 - else */
      port: (this.isEntrypoint ? this.serverConfig?.port || 0 : undefined) ?? true,
      host: (this.isEntrypoint ? this.serverConfig?.hostname : undefined) ?? true,
      telemetryConfig: this.telemetryConfig
    }
  }

  async spawn (command) {
    const [executable, ...args] = parseCommandString(command)
    const hasChainedCommands = command.includes('&&') || command.includes('||') || command.includes(';')

    /* c8 ignore next 3 */
    const subprocess =
      platform() === 'win32'
        ? spawn(command, { cwd: this.root, shell: true, windowsVerbatimArguments: true })
        : spawn(executable, args, { cwd: this.root, shell: hasChainedCommands })

    subprocess.stdout.setEncoding('utf8')
    subprocess.stderr.setEncoding('utf8')

    subprocess.stdout.pipe(this.stdout, { end: false })
    subprocess.stderr.pipe(this.stderr, { end: false })

    // Wait for the process to be started
    await new Promise((resolve, reject) => {
      subprocess.on('spawn', resolve)
      subprocess.on('error', reject)
    })

    return subprocess
  }

  notifyConfig (config) {
    this.emit('config', config)
  }

  _initializeLogger () {
    const loggerOptions = deepmerge(this.runtimeConfig?.logger ?? {}, this.config?.logger ?? {})
    const pinoOptions = buildPinoOptions(
      loggerOptions,
      this.serverConfig?.logger,
      this.serviceId,
      this.workerId,
      this.context,
      this.root
    )

    return pino(pinoOptions, this.standardStreams?.stdout)
  }

  async _collectMetrics () {
    if (this.#metricsCollected) {
      return
    }

    this.#metricsCollected = true

    if (this.context.metricsConfig === false) {
      return
    }

    await this.#collectMetrics()
    this.#setHttpCacheMetrics()
  }

  async #collectMetrics () {
    const metricsConfig = {
      defaultMetrics: true,
      httpMetrics: true,
      ...this.context.metricsConfig
    }

    if (this.childManager && this.clientWs) {
      await this.childManager.send(this.clientWs, 'collectMetrics', {
        serviceId: this.serviceId,
        workerId: this.workerId,
        metricsConfig
      })
      return
    }

    await collectMetrics(this.serviceId, this.workerId, metricsConfig, this.metricsRegistry)
  }

  #setHttpCacheMetrics () {
    const { client, registry } = globalThis.platformatic.prometheus

    // Metrics already registered, no need to register them again
    if (ensureMetricsGroup(registry, 'http.cache')) {
      return
    }

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

    const httpStatsFreeMetric = new client.Gauge({
      name: 'http_client_stats_free',
      help: 'Number of free (idle) http clients (sockets)',
      labelNames: ['dispatcher_stats_url'],
      registers: [registry]
    })
    globalThis.platformatic.onHttpStatsFree = (url, val) => {
      httpStatsFreeMetric.set({ dispatcher_stats_url: url }, val)
    }

    const httpStatsConnectedMetric = new client.Gauge({
      name: 'http_client_stats_connected',
      help: 'Number of open socket connections',
      labelNames: ['dispatcher_stats_url'],
      registers: [registry]
    })
    globalThis.platformatic.onHttpStatsConnected = (url, val) => {
      httpStatsConnectedMetric.set({ dispatcher_stats_url: url }, val)
    }

    const httpStatsPendingMetric = new client.Gauge({
      name: 'http_client_stats_pending',
      help: 'Number of pending requests across all clients',
      labelNames: ['dispatcher_stats_url'],
      registers: [registry]
    })
    globalThis.platformatic.onHttpStatsPending = (url, val) => {
      httpStatsPendingMetric.set({ dispatcher_stats_url: url }, val)
    }

    const httpStatsQueuedMetric = new client.Gauge({
      name: 'http_client_stats_queued',
      help: 'Number of queued requests across all clients',
      labelNames: ['dispatcher_stats_url'],
      registers: [registry]
    })
    globalThis.platformatic.onHttpStatsQueued = (url, val) => {
      httpStatsQueuedMetric.set({ dispatcher_stats_url: url }, val)
    }

    const httpStatsRunningMetric = new client.Gauge({
      name: 'http_client_stats_running',
      help: 'Number of currently active requests across all clients',
      labelNames: ['dispatcher_stats_url'],
      registers: [registry]
    })
    globalThis.platformatic.onHttpStatsRunning = (url, val) => {
      httpStatsRunningMetric.set({ dispatcher_stats_url: url }, val)
    }

    const httpStatsSizeMetric = new client.Gauge({
      name: 'http_client_stats_size',
      help: 'Number of active, pending, or queued requests across all clients',
      labelNames: ['dispatcher_stats_url'],
      registers: [registry]
    })
    globalThis.platformatic.onHttpStatsSize = (url, val) => {
      httpStatsSizeMetric.set({ dispatcher_stats_url: url }, val)
    }
  }

  async #invalidateHttpCache (opts = {}) {
    await globalThis[kITC].send('invalidateHttpCache', opts)
  }
}
