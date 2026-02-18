import {
  buildPinoOptions,
  deepmerge,
  executeWithTimeout,
  features,
  kHandledError,
  kMetadata,
  kTimeout
} from '@platformatic/foundation'
import {
  clearRegistry,
  client,
  collectThreadMetrics,
  ensureMetricsGroup,
  setupOtlpExporter
} from '@platformatic/metrics'
import { addPinoInstrumentation } from '@platformatic/telemetry'
import { parseCommandString } from 'execa'
import { spawn } from 'node:child_process'
import { tracingChannel } from 'node:diagnostics_channel'
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
  status
  type
  version
  root
  config
  context
  standardStreams

  applicationId
  workerId
  telemetryConfig
  serverConfig
  reuseTcpPorts
  openapiSchema
  graphqlSchema
  connectionString
  basePath
  isEntrypoint
  isProduction
  dependencies
  customHealthCheck
  customReadinessCheck
  clientWs
  runtimeConfig
  stdout
  stderr
  subprocessForceClose
  subprocessTerminationSignal
  logger
  metricsRegistry
  otlpBridge

  #subprocessStarted
  #metricsCollected
  #pendingDependenciesWaits
  #reuseTcpPortsSubscribers
  #closing

  constructor (type, version, root, config, context, standardStreams = {}) {
    super()

    this.status = ''
    this.type = type
    this.version = version
    this.root = root
    this.config = config
    this.context = context ?? {}
    this.context.worker ??= { count: 1, index: 0 }
    this.standardStreams = standardStreams

    this.applicationId = this.context.applicationId
    this.workerId = this.context.worker.index
    this.telemetryConfig = this.context.telemetryConfig
    this.serverConfig = deepmerge(this.context.serverConfig ?? {}, config.server ?? {})
    this.openapiSchema = null
    this.graphqlSchema = null
    this.connectionString = null
    this.basePath = null
    this.isEntrypoint = this.context.isEntrypoint
    this.isProduction = this.context.isProduction
    this.dependencies = this.context.dependencies ?? []
    this.customHealthCheck = null
    this.customReadinessCheck = null
    this.clientWs = null
    this.runtimeConfig = deepmerge(this.context?.runtimeConfig ?? {}, workerData?.config ?? {})
    this.stdout = standardStreams?.stdout ?? process.stdout
    this.stderr = standardStreams?.stderr ?? process.stderr
    this.subprocessForceClose = false
    this.subprocessTerminationSignal = 'SIGINT'
    this.logger = this._initializeLogger()
    this.reuseTcpPorts = this.config.reuseTcpPorts ?? this.runtimeConfig.reuseTcpPorts
    // True by default, can be overridden in subclasses. If false, it takes precedence over the runtime configuration
    this.exitOnUnhandledErrors = true

    // Track if graceful shutdown is in progress
    this.#closing = false

    // Listen for controller 'stopping' event to initiate graceful shutdown early
    if (this.context.controller) {
      this.context.controller.once('stopping', () => {
        this.setClosing()
      })
    }

    // Setup globals
    this.registerGlobals({
      capability: this,
      applicationId: this.applicationId,
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

    this.otlpBridge = null
    this.#metricsCollected = false
    this.#pendingDependenciesWaits = new Set()
  }

  async init () {
    if (this.status) {
      return
    }

    // Wait for explicit dependencies to start
    await this.waitForDependenciesStart(this.dependencies)

    if (this.status === 'stopped') {
      return
    }

    await this.updateContext()
    this.updateStatus('init')
    this.status = 'init'
  }

  getDependencies () {
    return this.dependencies ?? []
  }

  updateStatus (status) {
    this.status = status
    this.emit(status)
  }

  updateContext (_context) {
    // No-op by default
  }

  async updateMetricsConfig (metricsConfig) {
    // Transform applicationLabel to idLabel (same transformation as in worker/main.js)
    const normalizedConfig = {
      ...metricsConfig,
      idLabel: metricsConfig.applicationLabel || 'applicationId'
    }
    this.context.metricsConfig = normalizedConfig

    // If running in subprocess mode, send the update to the child process
    if (this.childManager && this.clientWs) {
      await this.childManager.send(this.clientWs, 'updateMetricsConfig', {
        applicationId: this.applicationId,
        workerId: this.workerId,
        metricsConfig: normalizedConfig
      })
      return
    }

    if (this.metricsRegistry) {
      // We must clear the registry to stop prom-client from collecting metrics in the background,
      // and because prom-client doesn't support changing labels on existing metrics.
      // This will lose all previously collected metrics.
      clearRegistry(this.metricsRegistry)

      if (metricsConfig.enabled !== false) {
        this.#metricsCollected = false
        await this._collectMetrics()
      }
    }
  }

  start () {
    throw new Error('BaseCapability.start must be overriden by the subclasses')
  }

  // This is to allow grand-children to access the method without calling super.stop()
  async stop () {
    return this._stop()
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

  async waitForDependenciesStart (dependencies = []) {
    if (!globalThis[kITC]) {
      return
    }

    const pending = new Set(dependencies)

    // Ask the runtime the status of the dependencies and don't wait if they are already started
    const workers = await globalThis[kITC].send('getWorkers')

    for (const worker of Object.values(workers)) {
      if (this.dependencies.includes(worker.application) && worker.status === 'started') {
        pending.delete(worker.application)
      }
    }

    if (!pending.size) {
      return
    }

    this.logger.info({ dependencies: Array.from(pending) }, 'Waiting for dependencies to start.')

    const { promise, resolve, reject } = Promise.withResolvers()

    function runtimeEventHandler ({ event, payload: [payload] }) {
      if (event !== 'application:worker:started') {
        return
      }

      pending.delete(payload.application)

      if (pending.size === 0) {
        cleanupEvents()
        resolve()
      }
    }

    function stopHandler () {
      cleanupEvents()

      const error = new Error('One of the service dependencies was unable to start.')
      error.dependencies = dependencies
      error[kHandledError] = true
      reject(error)
    }

    const cleanupEvents = () => {
      globalThis[kITC].removeListener('runtime:event', runtimeEventHandler)
      this.context.controller.removeListener('stopping', stopHandler)
      this.#pendingDependenciesWaits.delete(promise)
    }

    globalThis[kITC].on('runtime:event', runtimeEventHandler)
    this.context.controller.on('stopping', stopHandler)
    this.#pendingDependenciesWaits.add(promise)

    return promise
  }

  async waitForDependentsStop (dependents = []) {
    if (!globalThis[kITC]) {
      return
    }

    const pending = new Set(dependents)

    // Ask the runtime the status of the dependencies and don't wait if they are already stopped
    const workers = await globalThis[kITC].send('getWorkers')

    for (const worker of Object.values(workers)) {
      if (this.dependencies.includes(worker.application) && worker.status === 'started') {
        pending.delete(worker.application)
      }
    }

    if (!pending.size) {
      return
    }

    this.logger.info({ dependents: Array.from(pending) }, 'Waiting for dependents to stop.')

    const { promise, resolve } = Promise.withResolvers()

    function runtimeEventHandler ({ event, payload: [payload] }) {
      if (event !== 'application:worker:stopped') {
        return
      }

      pending.delete(payload.application)

      if (pending.size === 0) {
        globalThis[kITC].removeListener('runtime:event', runtimeEventHandler)
        resolve()
      }
    }

    globalThis[kITC].on('runtime:event', runtimeEventHandler)
    return promise
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
    return { type: this.type, version: this.version, dependencies: this.dependencies }
  }

  getDispatchFunc () {
    return this
  }

  async getDispatchTarget () {
    return this.getUrl() ?? (await this.getDispatchFunc())
  }

  getMeta () {
    return {
      gateway: {
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

  get closing () {
    return this.#closing
  }

  setClosing () {
    if (this.#closing) return
    this.#closing = true
    this.emit('closing')

    // Forward to child process if using childManager
    if (this.childManager && this.clientWs) {
      this.childManager.send(this.clientWs, 'setClosing', {}).catch(() => {})
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
      this.childManager = null
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

    this.setupChildManagerEventsForwarding(this.childManager)

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
    const exitTimeout = this.runtimeConfig.gracefulShutdown.application

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

    // This is needed to correctly handle reusePort in child processes when using build
    if (this.reuseTcpPorts && !features.node.reusePort) {
      this.reuseTcpPorts = false
    }

    return {
      id: this.id,
      config: this.config,
      applicationId: this.applicationId,
      workerId: this.workerId,
      // Always use URL to avoid serialization problem in Windows
      root: pathToFileURL(this.root).toString(),
      basePath,
      logLevel: this.logger.level,
      isEntrypoint: this.isEntrypoint,
      reuseTcpPorts: this.reuseTcpPorts,
      runtimeBasePath: this.runtimeConfig?.basePath ?? null,
      wantsAbsoluteUrls: meta.gateway?.wantsAbsoluteUrls ?? false,
      exitOnUnhandledErrors: this.runtimeConfig.exitOnUnhandledErrors ?? true,
      /* c8 ignore next 2 - else */
      port: (this.isEntrypoint ? this.serverConfig?.port || 0 : undefined) ?? true,
      host: (this.isEntrypoint ? this.serverConfig?.hostname : undefined) ?? true,
      additionalServerOptions:
        typeof this.serverConfig?.backlog === 'number'
          ? {
              backlog: this.serverConfig.backlog
            }
          : {},
      telemetryConfig: this.telemetryConfig,
      compileCache: this.config.compileCache ?? this.runtimeConfig?.compileCache
    }
  }

  setupChildManagerEventsForwarding (childManager) {
    childManager.on('config', config => {
      this.subprocessConfig = config
      this.notifyConfig(config)
    })

    childManager.on('connectionString', connectionString => {
      this.connectionString = connectionString
    })

    childManager.on('openapiSchema', schema => {
      this.openapiSchema = schema
    })

    childManager.on('graphqlSchema', schema => {
      this.graphqlSchema = schema
    })

    childManager.on('basePath', path => {
      this.basePath = path
    })

    childManager.on('event', event => {
      globalThis[kITC]?.notify('event', event)
      this.emit('application:worker:event:' + event.event, event.payload)
    })

    // Forward health signals from child process to runtime
    childManager.on('healthSignals', ({ workerId, signals }) => {
      globalThis[kITC]?.send('sendHealthSignals', { workerId, signals })
    })

    // This is not really important for the URL but sometimes it also a sign
    // that the process has been replaced and thus we need to update the client WebSocket
    childManager.on('url', (url, clientWs) => {
      this.url = url
      this.clientWs = clientWs
    })
  }

  async spawn (command) {
    let [executable, ...args] = parseCommandString(command)
    const hasChainedCommands = command.includes('&&') || command.includes('||') || command.includes(';')

    // Use the current Node.js executable instead of relying on PATH lookup
    // This ensures subprocess uses the same Node.js version as the parent
    if (executable === 'node') {
      executable = process.execPath
    }

    /* c8 ignore next 3 */
    const subprocess =
      platform() === 'win32'
        ? spawn(command.replace(/^node\b/, process.execPath), {
          cwd: this.root,
          shell: true,
          windowsVerbatimArguments: true
        })
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
      this.applicationId,
      this.workerId,
      this.context,
      this.root
    )

    if (loggerOptions.openTelemetryExporter && this.telemetryConfig?.enabled !== false) {
      addPinoInstrumentation(pinoOptions)
    }

    return pino(pinoOptions, this.standardStreams?.stdout)
  }

  _start () {
    if (this.reuseTcpPorts) {
      if (!features.node.reusePort) {
        this.reuseTcpPorts = false
      } else {
        this.#reuseTcpPortsSubscribers = {
          asyncStart ({ options }) {
            options.reusePort = true
          }
        }

        tracingChannel('net.server.listen').subscribe(this.#reuseTcpPortsSubscribers)
      }
    }
  }

  async _stop () {
    if (this.#pendingDependenciesWaits.size > 0) {
      await Promise.allSettled(this.#pendingDependenciesWaits)
    }

    if (this.#reuseTcpPortsSubscribers) {
      tracingChannel('net.server.listen').unsubscribe(this.#reuseTcpPortsSubscribers)
      this.#reuseTcpPortsSubscribers = null
    }

    // Stop OTLP bridge if running
    if (this.otlpBridge) {
      this.otlpBridge.stop()
      this.otlpBridge = null
    }
  }

  async _collectMetrics () {
    if (this.#metricsCollected) {
      return
    }

    this.#metricsCollected = true

    if (this.context.metricsConfig === false || this.context.metricsConfig?.enabled === false) {
      return
    }

    await this.#collectMetrics()
    this.#setHttpCacheMetrics()
    await this.#setupOtlpExporter()
  }

  _closeServer (server) {
    const { promise, resolve, reject } = Promise.withResolvers()

    server.close(error => {
      if (error) {
        return reject(error)
      }

      resolve()
    })

    return promise
  }

  async #collectMetrics () {
    const metricsConfig = {
      defaultMetrics: true,
      httpMetrics: true,
      ...this.context.metricsConfig
    }

    if (this.childManager && this.clientWs) {
      await this.childManager.send(this.clientWs, 'collectMetrics', {
        applicationId: this.applicationId,
        workerId: this.workerId,
        metricsConfig
      })
      return
    }

    // Use thread-specific metrics collection - process-level metrics are collected
    // by the main runtime thread and duplicated with worker labels
    await collectThreadMetrics(this.applicationId, this.workerId, metricsConfig, this.metricsRegistry)
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

    const activeResourcesEventLoopMetric = new client.Gauge({
      name: 'active_resources_event_loop',
      help: 'Number of active resources keeping the event loop alive',
      registers: [registry]
    })
    globalThis.platformatic.onActiveResourcesEventLoop = val => activeResourcesEventLoopMetric.set(val)
  }

  async #setupOtlpExporter () {
    const metricsConfig = this.context.metricsConfig
    if (!metricsConfig || !metricsConfig.otlpExporter) {
      return
    }

    // Wait for telemetry to be ready before loading promotel to avoid race condition
    if (globalThis.platformatic?.telemetryReady) {
      await globalThis.platformatic.telemetryReady
    }

    // Setup and start OTLP exporter bridge
    this.otlpBridge = await setupOtlpExporter(this.metricsRegistry, metricsConfig.otlpExporter, this.applicationId)

    if (this.otlpBridge) {
      this.otlpBridge.start()
      this.logger.info(
        {
          endpoint: metricsConfig.otlpExporter.endpoint,
          interval: metricsConfig.otlpExporter.interval || 60000
        },
        'OTLP metrics exporter started'
      )
    }
  }

  async #invalidateHttpCache (opts = {}) {
    await globalThis[kITC].send('invalidateHttpCache', opts)
  }
}
