import {
  deepmerge,
  ensureError,
  ensureLoggableError,
  executeInParallel,
  executeWithTimeout,
  features,
  kMetadata,
  kTimeout,
  parseMemorySize
} from '@platformatic/foundation'
import { ITC } from '@platformatic/itc'
import { collectProcessMetrics, client as metricsClient } from '@platformatic/metrics'
import fastify from 'fastify'
import { EventEmitter, once } from 'node:events'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { STATUS_CODES } from 'node:http'
import { createRequire } from 'node:module'
import { availableParallelism } from 'node:os'
import { dirname, isAbsolute, join } from 'node:path'
import { setImmediate as immediate, setTimeout as sleep } from 'node:timers/promises'
import { pathToFileURL } from 'node:url'
import { Worker } from 'node:worker_threads'
import SonicBoom from 'sonic-boom'
import { Agent, request, interceptors as undiciInterceptors } from 'undici'
import { createThreadInterceptor } from 'undici-thread-interceptor'
import { pprofCapturePreloadPath } from './config.js'
import {
  ApplicationAlreadyStartedError,
  ApplicationNotFoundError,
  ApplicationNotStartedError,
  ApplicationStartTimeoutError,
  CannotRemoveEntrypointError,
  InvalidArgumentError,
  MessagingError,
  MissingEntrypointError,
  MissingPprofCapture,
  RuntimeAbortedError,
  WorkerInterceptorJoinTimeoutError,
  WorkerNotFoundError
} from './errors.js'
import { abstractLogger, createLogger } from './logger.js'
import { startManagementApi } from './management-api.js'
import { createChannelCreationHook } from './policies.js'
import { startPrometheusServer } from './prom-server.js'
import { startScheduler } from './scheduler.js'
import { createSharedStore } from './shared-http-cache.js'
import { topologicalSort } from './utils.js'
import { version } from './version.js'
import { DynamicWorkersScaler } from './worker-scaler.js'
import { HealthSignalsQueue } from './worker/health-signals.js'
import { sendMultipleViaITC, sendViaITC, waitEventFromITC } from './worker/itc.js'
import { RoundRobinMap } from './worker/round-robin-map.js'
import {
  kApplicationId,
  kConfig,
  kFullId,
  kHealthCheckTimer,
  kId,
  kInterceptorReadyPromise,
  kITC,
  kLastHealthCheckELU,
  kStderrMarker,
  kWorkerHealthSignals,
  kWorkerId,
  kWorkersBroadcast,
  kWorkerStartTime,
  kWorkerStatus
} from './worker/symbols.js'

const kWorkerFile = join(import.meta.dirname, 'worker/main.js')
const kInspectorOptions = Symbol('plt.runtime.worker.inspectorOptions')
const kHeapCheckCounter = Symbol('plt.runtime.worker.heapCheckCounter')
const kLastHeapStats = Symbol('plt.runtime.worker.lastHeapStats')

const MAX_LISTENERS_COUNT = 100

function parseOrigins (origins) {
  if (!origins) return undefined

  return origins.map(origin => {
    // Check if the origin is a regex pattern (starts and ends with /)
    if (origin.startsWith('/') && origin.lastIndexOf('/') > 0) {
      const lastSlash = origin.lastIndexOf('/')
      const pattern = origin.slice(1, lastSlash)
      const flags = origin.slice(lastSlash + 1)
      return new RegExp(pattern, flags)
    }
    return origin
  })
}

// Always run operations in parallel to avoid deadlocks when services have dependencies
const DEFAULT_CONCURRENCY = availableParallelism() * 2
const MAX_BOOTSTRAP_ATTEMPTS = 5
const IMMEDIATE_RESTART_MAX_THRESHOLD = 10
const MAX_WORKERS = 100

export class Runtime extends EventEmitter {
  logger
  error

  #loggerDestination
  #loggerContext
  #stdio

  #status // starting, started, stopping, stopped, closed
  #root
  #config
  #env
  #context
  #sharedContext
  #isProduction
  #concurrency
  #entrypointId
  #url

  #healthMetricsTimer

  #meshInterceptor
  #dispatcher

  #managementApi
  #prometheusServer
  #inspectorServer
  #metricsLabelName

  #applicationsConfigsPatches
  #applications
  #workers
  #workersBroadcastChannel
  #workerITCHandlers
  #restartingApplications
  #restartingWorkers
  #dynamicWorkersScaler

  #sharedHttpCache
  #scheduler

  #channelCreationHook

  #processMetricsRegistry

  constructor (config, context) {
    super()
    this.setMaxListeners(MAX_LISTENERS_COUNT)

    this.#config = config
    this.#root = config[kMetadata].root
    this.#env = config[kMetadata].env
    this.#context = context ?? {}
    this.#isProduction = this.#context.isProduction ?? this.#context.production ?? false
    this.#concurrency = Math.max(1, config.startupConcurrency ?? this.#context.concurrency ?? DEFAULT_CONCURRENCY)
    this.#applications = new Map()
    this.#workers = new RoundRobinMap()
    this.#url = undefined
    this.#channelCreationHook = createChannelCreationHook(this.#config)
    this.#meshInterceptor = createThreadInterceptor({
      domain: '.plt.local',
      timeout: this.#config.applicationTimeout,
      meshTimeout: this.#context.meshTimeout ?? true,
      onChannelCreation: this.#channelCreationHook,
      onError: this.#onMeshInterceptorError.bind(this)
    })
    this.logger = abstractLogger // This is replaced by the real logger in init() and eventually removed in close()
    this.#status = undefined
    this.#restartingApplications = new Set()
    this.#restartingWorkers = new Map()
    this.#sharedHttpCache = null
    this.#applicationsConfigsPatches = new Map()

    if (!this.#config.logger.captureStdio) {
      this.#stdio = {
        stdout: new SonicBoom({ fd: process.stdout.fd }),
        stderr: new SonicBoom({ fd: process.stderr.fd })
      }
    }

    this.#workerITCHandlers = {
      getApplicationMeta: this.getApplicationMeta.bind(this),
      listApplications: this.getApplicationsIds.bind(this),
      getApplications: this.getApplications.bind(this),
      getWorkers: this.getWorkers.bind(this),
      getWorkerMessagingChannel: this.#getWorkerMessagingChannel.bind(this),
      getHttpCacheValue: this.#getHttpCacheValue.bind(this),
      setHttpCacheValue: this.#setHttpCacheValue.bind(this),
      deleteHttpCacheValue: this.#deleteHttpCacheValue.bind(this),
      invalidateHttpCache: this.invalidateHttpCache.bind(this),
      updateSharedContext: this.updateSharedContext.bind(this),
      getSharedContext: this.getSharedContext.bind(this),
      sendHealthSignals: this.#processHealthSignals.bind(this)
    }
    this.#sharedContext = {}

    if (this.#isProduction) {
      this.#env.PLT_DEV = 'false'
      this.#env.PLT_ENVIRONMENT = 'production'
    } else {
      this.#env.PLT_DEV = 'true'
      this.#env.PLT_ENVIRONMENT = 'development'
    }
  }

  async init () {
    if (typeof this.#status !== 'undefined') {
      return
    }

    const config = this.#config

    if (config.managementApi) {
      this.#managementApi = await startManagementApi(this, config.managementApi)
    }

    if (config.metrics) {
      // Use the configured application label name for metrics (defaults to 'applicationId')
      this.#metricsLabelName = config.metrics.applicationLabel || 'applicationId'
      this.#prometheusServer = await startPrometheusServer(this, config.metrics)
    } else {
      // Default to applicationId if metrics are not configured
      this.#metricsLabelName = 'applicationId'
    }

    // Initialize process-level metrics registry in the main thread if metrics or management API is enabled
    // These metrics are the same across all workers and only need to be collected once
    // We need this for management API as it can request metrics even without explicit metrics config
    if (config.metrics || config.managementApi) {
      this.#processMetricsRegistry = new metricsClient.Registry()
      collectProcessMetrics(this.#processMetricsRegistry)
    }

    // Create the logger
    const [logger, destination, context] = await createLogger(config)
    this.logger = logger
    this.#loggerDestination = destination
    this.#loggerContext = context

    this.#createWorkersBroadcastChannel()

    if (this.#config.workers.dynamic) {
      if (this.#config.workers.dynamic === false) {
        this.logger.warn(
          `Worker scaler disabled because the "workers" configuration is set to ${this.#config.workers.static}.`
        )
      } else {
        this.#dynamicWorkersScaler = new DynamicWorkersScaler(this, this.#config.workers)
      }
    }

    await this.addApplications(this.#config.applications)
    await this.#setDispatcher(config.undici)

    if (config.scheduler && !this.#context.build) {
      this.#scheduler = startScheduler(config.scheduler, this.#dispatcher, logger)
    }

    this.#updateStatus('init')
  }

  async start (silent = false) {
    if (typeof this.#status === 'undefined') {
      await this.init()
    }

    if (typeof this.#config.entrypoint === 'undefined') {
      throw new MissingEntrypointError()
    }
    this.#updateStatus('starting')
    this.#createWorkersBroadcastChannel()

    try {
      await this.startApplications(this.getApplicationsIds(), silent)

      if (this.#config.inspectorOptions) {
        const { port } = this.#config.inspectorOptions

        const server = fastify({
          loggerInstance: this.logger.child({ name: 'inspector' }, { level: 'warn' })
        })

        const version = await fetch(`http://127.0.0.1:${this.#config.inspectorOptions.port + 1}/json/version`).then(
          res => res.json()
        )

        const data = await Promise.all(
          Array.from(this.#workers.values()).map(async worker => {
            const data = worker[kInspectorOptions]

            const res = await fetch(`http://127.0.0.1:${data.port}/json/list`)
            const details = await res.json()
            return {
              ...details[0],
              title: data.id
            }
          })
        )

        server.get('/json/list', () => data)
        server.get('/json', () => data)
        server.get('/json/version', () => version)

        await server.listen({ port })
        this.logger.info(
          'The inspector server is now listening for all applications. Open `chrome://inspect` in Google Chrome to connect.'
        )
        this.#inspectorServer = server
      }
    } catch (error) {
      await this.closeAndThrow(error)
    }

    this.#updateStatus('started')

    // Start the global health metrics timer for all workers if needed
    this.#startHealthMetricsCollectionIfNeeded()

    await this.#dynamicWorkersScaler?.start()
    this.#showUrl()
    return this.#url
  }

  async stop (silent = false) {
    if (this.#status === 'starting') {
      await once(this, 'started')
    }

    this.#updateStatus('stopping')

    if (this.#scheduler) {
      await this.#scheduler.stop()
    }

    if (this.#inspectorServer) {
      await this.#inspectorServer.close()
    }

    await this.#dynamicWorkersScaler?.stop()

    // Stop the entrypoint first so that no new requests are accepted
    if (this.#entrypointId) {
      await this.stopApplication(this.#entrypointId, silent)
    }

    await this.stopApplications(this.getApplicationsIds(), silent)

    await this.#meshInterceptor.close()
    this.#workersBroadcastChannel?.close()

    this.#updateStatus('stopped')
  }

  async restart (applications = []) {
    this.emitAndNotify('restarting')

    const toRestart = []
    for (const application of this.getApplicationsIds()) {
      if (applications.length === 0 || applications.includes(application)) {
        toRestart.push(application)
      }
    }
    await this.restartApplications(toRestart)

    this.emitAndNotify('restarted')

    return this.#url
  }

  async close (silent = false) {
    clearTimeout(this.#healthMetricsTimer)

    await this.stop(silent)
    this.#updateStatus('closing')

    // The management API autocloses by itself via event in management-api.js.
    // This is needed to let management API stop endpoint to reply.

    if (this.#prometheusServer) {
      await this.#prometheusServer.close()
    }

    // Clean up process metrics registry
    if (this.#processMetricsRegistry) {
      this.#processMetricsRegistry.clear()
      this.#processMetricsRegistry = null
    }

    if (this.#sharedHttpCache?.close) {
      await this.#sharedHttpCache.close()
    }

    if (this.logger) {
      this.#loggerDestination?.end()

      this.logger = abstractLogger
      this.#loggerDestination = null
      this.#loggerContext = null
    }

    this.#updateStatus('closed')
  }

  async closeAndThrow (error) {
    this.#updateStatus('errored', error)
    this.error = error

    // Wait for the next tick so that any pending logging is properly flushed
    await sleep(1)
    await this.close()

    throw error
  }

  async inject (id, injectParams) {
    // Make sure the application exists
    await this.#getApplicationById(id, true)

    if (typeof injectParams === 'string') {
      injectParams = { url: injectParams }
    }

    let { method, headers, body } = injectParams
    const url = new URL(injectParams.url, `http://${id}.plt.local`)

    if (injectParams.query) {
      for (const [k, v] of Object.entries(injectParams.query)) {
        url.searchParams.append(k, v)
      }
    }

    // Stringify the body as JSON if needed
    if (
      body &&
      typeof body === 'object' &&
      headers &&
      Object.entries(headers).some(([k, v]) => k.toLowerCase() === 'content-type' && v.includes('application/json'))
    ) {
      body = JSON.stringify(body)
    }

    const {
      statusCode: responseStatus,
      headers: responseHeaders,
      body: responseRawBody
    } = await request(url.toString(), { method, headers, body, dispatcher: this.#dispatcher })
    const responsePayload = await responseRawBody.arrayBuffer()
    const responseBody = Buffer.from(responsePayload).toString('utf-8')

    return {
      statusCode: responseStatus,
      statusMessage: STATUS_CODES[responseStatus] || 'unknown',
      headers: responseHeaders,
      body: responseBody,
      payload: responseBody,
      rawPayload: responsePayload
    }
  }

  emitAndNotify (event, ...payload) {
    for (const worker of this.#workers.values()) {
      worker[kITC].notify('runtime:event', { event, payload })
    }

    this.logger.trace({ event, payload }, 'Runtime event')
    return this.emit(event, ...payload)
  }

  async sendCommandToApplication (id, name, message) {
    const application = await this.#getApplicationById(id)

    try {
      return await sendViaITC(application, name, message)
    } catch (e) {
      // The application exports no meta, return an empty object
      if (e.code === 'PLT_ITC_HANDLER_NOT_FOUND') {
        return {}
      }

      throw e
    }
  }

  async addApplications (applications, start = false) {
    const setupInvocations = []

    const toStart = []
    for (const application of applications) {
      const workers = application.workers

      if ((workers.static > 1 || workers.minimum > 1) && application.entrypoint && !features.node.reusePort) {
        this.logger.warn(
          `"${application.id}" is set as the entrypoint, but reusePort is not available in your OS; setting workers to 1 instead of ${workers.static}`
        )
        application.workers = { dynamic: false, static: 1 }
      }

      this.#applications.set(application.id, application)
      setupInvocations.push([application])
      toStart.push(application.id)
    }

    await executeInParallel(this.#setupApplication.bind(this), setupInvocations, this.#concurrency)

    for (const application of applications) {
      this.logger.debug(`Added application "${application.id}"${application.entrypoint ? ' (entrypoint)' : ''}.`)
      this.emitAndNotify('application:added', application)
    }

    if (start) {
      await this.startApplications(toStart)
    }

    const created = []
    for (const { id } of applications) {
      created.push(await this.getApplicationDetails(id))
    }

    this.#updateLoggingPrefixes()
    return created
  }

  async removeApplications (applications, silent = false) {
    if (applications.includes(this.#entrypointId)) {
      throw new CannotRemoveEntrypointError()
    }

    const removed = []
    for (const application of applications) {
      const details = await this.getApplicationDetails(application)
      details.status = 'removed'
      removed.push(details)
    }

    await this.stopApplications(applications, silent, true)

    for (const application of applications) {
      this.#dynamicWorkersScaler?.remove(application)
      this.#applications.delete(application)
    }

    for (const application of applications) {
      this.logger.warn(`Removed application "${application}".`)
      this.emitAndNotify('application:removed', application)
    }

    this.#updateLoggingPrefixes()
    return removed
  }

  async startApplications (applications, silent = false) {
    // For each worker, get its dependencies from the first worker
    const dependencies = new Map()
    for (const applicationId of applications) {
      const worker = await this.#getWorkerByIdOrNext(applicationId, 0)

      dependencies.set(applicationId, await sendViaITC(worker, 'getDependencies'))
    }

    // Now, topological sort the applications based on their dependencies.
    // If circular dependencies are detected, an error with proper error code is thrown.
    applications = topologicalSort(dependencies)

    const startInvocations = []
    for (const application of applications) {
      startInvocations.push([application, silent])
    }

    return executeInParallel(this.startApplication.bind(this), startInvocations, this.#concurrency)
  }

  async stopApplications (applicationsToStop, silent = false, skipDependencies = false) {
    const stopInvocations = []

    // Construct the reverse dependency graph
    const dependents = {}

    if (!skipDependencies) {
      try {
        const { applications } = await this.getApplications(true)
        for (const application of applications) {
          for (const dependency of application.dependencies ?? []) {
            let applicationDependents = dependents[dependency]
            if (!applicationDependents) {
              applicationDependents = new Set()
              dependents[dependency] = applicationDependents
            }

            applicationDependents.add(application.id)
          }
        }
      } catch (e) {
        // Noop - This only happens if stop is invoked after a failed start, in which case we don't care about deps
      }
    }

    for (const application of applicationsToStop) {
      // The entrypoint has been stopped above
      if (application === this.#entrypointId) {
        continue
      }

      stopInvocations.push([application, silent, Array.from(dependents[application] ?? [])])
    }

    return executeInParallel(this.stopApplication.bind(this), stopInvocations, this.#concurrency)
  }

  async restartApplications (applicationsToRestart) {
    const restartInvocations = []

    for (const application of applicationsToRestart) {
      restartInvocations.push([application])
    }

    return executeInParallel(this.restartApplication.bind(this), restartInvocations, this.#concurrency)
  }

  async startApplication (id, silent = false) {
    const config = this.#config
    const applicationConfig = this.#applications.get(id)

    if (!applicationConfig) {
      throw new ApplicationNotFoundError(id, this.getApplicationsIds().join(', '))
    }

    const workers = applicationConfig.workers.static
    for (let i = 0; i < workers; i++) {
      const worker = this.#workers.get(`${id}:${i}`)
      const status = worker?.[kWorkerStatus]

      if (status && status !== 'boot' && status !== 'init') {
        throw new ApplicationAlreadyStartedError()
      }
    }

    this.emitAndNotify('application:starting', id)

    for (let i = 0; i < workers; i++) {
      await this.#startWorker(config, applicationConfig, workers, id, i, silent)
    }

    this.emitAndNotify('application:started', id)
  }

  async stopApplication (id, silent = false, dependents = []) {
    if (!this.#applications.has(id)) {
      throw new ApplicationNotFoundError(id, this.getApplicationsIds().join(', '))
    }

    const workersIds = this.#workers.getKeys(id)
    const workersCount = workersIds.length

    this.emitAndNotify('application:stopping', id)

    if (typeof workersCount === 'number') {
      const stopInvocations = []
      for (const workerId of workersIds) {
        const i = parseInt(workerId.split(':')[1])
        stopInvocations.push([workersCount, id, i, silent, undefined, dependents])
      }

      await executeInParallel(this.#stopWorker.bind(this), stopInvocations, this.#concurrency)
    }

    this.emitAndNotify('application:stopped', id)
  }

  async restartApplication (id) {
    const applicationConfig = this.#applications.get(id)

    if (!applicationConfig) {
      throw new ApplicationNotFoundError(id, this.getApplicationsIds().join(', '))
    }

    if (this.#restartingApplications.has(id)) {
      return
    }
    this.#restartingApplications.add(id)

    try {
      const config = this.#config
      const workersIds = await this.#workers.getKeys(id)
      const workersCount = workersIds.length

      this.emitAndNotify('application:restarting', id)

      for (let i = 0; i < workersCount; i++) {
        const workerId = workersIds[i]
        const worker = this.#workers.get(workerId)

        if (i > 0 && config.workersRestartDelay > 0) {
          await sleep(config.workersRestartDelay)
        }

        await this.#replaceWorker(config, applicationConfig, workersCount, id, i, worker, true)
      }

      this.emitAndNotify('application:restarted', id)
    } finally {
      this.#restartingApplications.delete(id)
    }
  }

  async buildApplication (id) {
    const application = await this.#getApplicationById(id)

    this.emitAndNotify('application:building', id)
    try {
      await sendViaITC(application, 'build')
      this.emitAndNotify('application:built', id)
    } catch (e) {
      // The application exports no meta, return an empty object
      if (e.code === 'PLT_ITC_HANDLER_NOT_FOUND') {
        return {}
      }

      throw e
    }
  }

  async startApplicationProfiling (id, options = {}, ensureStarted = true) {
    const service = await this.#getApplicationById(id, ensureStarted)
    this.#validatePprofCapturePreload()

    return sendViaITC(service, 'startProfiling', options)
  }

  async stopApplicationProfiling (id, options = {}, ensureStarted = true) {
    const service = await this.#getApplicationById(id, ensureStarted)
    this.#validatePprofCapturePreload()

    return sendViaITC(service, 'stopProfiling', options)
  }

  async startApplicationRepl (id, ensureStarted = true) {
    const service = await this.#getApplicationById(id, ensureStarted)

    // Create a MessageChannel for REPL communication
    const { port1, port2 } = new MessageChannel()

    // Send port1 to the worker to start the REPL
    await sendViaITC(service, 'startRepl', port1, [port1])

    // Return port2 for the caller to use
    return port2
  }

  async updateUndiciInterceptors (undiciConfig) {
    this.#config.undici = undiciConfig

    const promises = []
    for (const worker of this.#workers.values()) {
      promises.push(sendViaITC(worker, 'updateUndiciInterceptors', undiciConfig))
    }

    const results = await Promise.allSettled(promises)
    for (const result of results) {
      if (result.status === 'rejected') {
        throw result.reason
      }
    }
  }

  /**
   * Updates the metrics configuration at runtime without restarting the runtime or workers.
   *
   * This method allows you to:
   * - Enable or disable metrics collection
   * - Change Prometheus server settings (port, endpoint, authentication)
   * - Update custom labels for metrics
   *
   * @example
   * // Enable metrics with custom port
   * await runtime.updateMetricsConfig({
   *   enabled: true,
   *   port: 9091,
   *   labels: { environment: 'production' }
   * })
   *
   * // Disable metrics
   * await runtime.updateMetricsConfig({ enabled: false })
   */
  async updateMetricsConfig (metricsConfig) {
    if (this.#prometheusServer) {
      await this.#prometheusServer.close()
      this.#prometheusServer = null
    }

    this.#config.metrics = metricsConfig
    this.#metricsLabelName = metricsConfig?.applicationLabel || 'applicationId'

    if (metricsConfig.enabled !== false) {
      this.#prometheusServer = await startPrometheusServer(this, metricsConfig)
    }

    const promises = []
    for (const worker of this.#workers.values()) {
      if (worker[kWorkerStatus] === 'started') {
        promises.push(sendViaITC(worker, 'updateMetricsConfig', metricsConfig))
      }
    }

    const results = await Promise.allSettled(promises)
    for (const result of results) {
      if (result.status === 'rejected') {
        this.logger.error({ err: result.reason }, 'Cannot update metrics config on worker')
      }
    }

    this.logger.info({ metricsConfig }, 'Metrics configuration updated')
    return { success: true, config: metricsConfig }
  }

  // TODO: Remove in next major version
  startCollectingMetrics () {
    this.logger.warn(
      'startCollectingMetrics() is deprecated and no longer collects metrics. Metrics are now polled on-demand by the management API.'
    )
  }

  // TODO: Remove in next major version
  getCachedMetrics () {
    this.logger.warn('getCachedMetrics() is deprecated and returns an empty array. Metrics are no longer cached.')
    return []
  }

  invalidateHttpCache (options = {}) {
    const { keys, tags } = options

    if (!this.#sharedHttpCache) {
      return
    }

    const promises = []
    if (keys && keys.length > 0) {
      promises.push(this.#sharedHttpCache.deleteKeys(keys))
    }

    if (tags && tags.length > 0) {
      promises.push(this.#sharedHttpCache.deleteTags(tags))
    }

    return Promise.all(promises)
  }

  async addLoggerDestination (writableStream) {
    // Add the stream - We output everything we get
    this.#loggerDestination.add({ stream: writableStream, level: 1 })

    // Immediately get the counter of the lastId so we can use it to later remove it
    const id = this.#loggerDestination.lastId

    const onClose = () => {
      writableStream.removeListener('close', onClose)
      writableStream.removeListener('error', onClose)
      this.removeListener('closed', onClose)
      this.#loggerDestination.remove(id)
    }

    writableStream.on('close', onClose)
    writableStream.on('error', onClose)
    this.on('closed', onClose)
  }

  async updateSharedContext (options = {}) {
    const { context, overwrite = false } = options

    const sharedContext = overwrite ? {} : this.#sharedContext
    Object.assign(sharedContext, context)

    this.#sharedContext = sharedContext

    const promises = []
    for (const worker of this.#workers.values()) {
      promises.push(sendViaITC(worker, 'setSharedContext', sharedContext))
    }

    const results = await Promise.allSettled(promises)
    for (const result of results) {
      if (result.status === 'rejected') {
        this.logger.error({ err: result.reason }, 'Cannot update shared context')
      }
    }

    return sharedContext
  }

  setApplicationConfigPatch (id, patch) {
    this.#applicationsConfigsPatches.set(id, patch)
  }

  removeApplicationConfigPatch (id) {
    this.#applicationsConfigsPatches.delete(id)
  }

  /**
   * Updates the resources of the applications, such as the number of workers and health configurations (e.g., heap memory settings).
   *
   * This function handles three update scenarios for each application:
   *  1. **Updating workers only**: Adjusts the number of workers for the application.
   *  2. **Updating health configurations only**: Updates health parameters like `maxHeapTotal` or `maxYoungGeneration`.
   *  3. **Updating both workers and health configurations**: Scales the workers and also applies health settings.
   *
   * When updating both workers and health:
   *  - **Scaling down workers**: Stops extra workers, then restarts the remaining workers with the previous settings.
   *  - **Scaling up workers**: Starts new workers with the updated heap settings, then restarts the old workers with the updated settings.
   *
   * Scaling up new resources (workers and/or heap memory) may fails due to insufficient memory, in this case the operation may fail partially or entirely.
   * Scaling down is expected to succeed without issues.
   *
   * @param {Array<Object>} updates - An array of objects that define the updates for each application.
   * @param {string} updates[].application - The ID of the application to update.
   * @param {number} [updates[].workers] - The desired number of workers for the application. If omitted, workers will not be updated.
   * @param {Object} [updates[].health] - The health configuration to update for the application, which may include:
   *   @param {string|number} [updates[].health.maxHeapTotal] - The maximum heap memory for the application. Can be a valid memory string (e.g., '1G', '512MB') or a number representing bytes.
   *   @param {string|number} [updates[].health.maxYoungGeneration] - The maximum young generation memory for the application. Can be a valid memory string (e.g., '128MB') or a number representing bytes.
   *
   * @returns {Promise<Array<Object>>} - A promise that resolves to an array of reports for each application, detailing the success or failure of the operations:
   *   - `application`: The application ID.
   *   - `workers`: The workers' update report, including the current, new number of workers, started workers, and success status.
   *   - `health`: The health update report, showing the current and new heap settings, updated workers, and success status.
   *
   * @example
   * await runtime.updateApplicationsResources([
   *   { application: 'application-1', workers: 2, health: { maxHeapTotal: '1G', maxYoungGeneration: '128 MB' } },
   *   { application: 'application-2', health: { maxHeapTotal: '1G' } },
   *   { application: 'application-3', workers: 2 },
   * ])
   *
   * In this example:
   * - `application-1` will have 2 workers and updated heap memory configurations.
   * - `application-2` will have updated heap memory settings (without changing workers).
   * - `application-3` will have its workers set to 2 but no change in memory settings.
   *
   * @throws {InvalidArgumentError} - Throws if any update parameter is invalid, such as:
   *   - Missing application ID.
   *   - Invalid worker count (not a positive integer).
   *   - Invalid memory size format for `maxHeapTotal` or `maxYoungGeneration`.
   * @throws {ApplicationNotFoundError} - Throws if the specified application ID does not exist in the current application configuration.
   */
  async updateApplicationsResources (updates) {
    if (this.#status === 'stopping' || this.#status === 'closed') {
      this.logger.warn('Cannot update application resources when the runtime is stopping or closed')
      return
    }

    const ups = await this.#validateUpdateApplicationResources(updates)
    const config = this.#config

    const report = []
    for (const update of ups) {
      const { applicationId, config: applicationConfig, workers, health, currentWorkers, currentHealth } = update

      if (workers && health) {
        const r = await this.#updateApplicationWorkersAndHealth(
          applicationId,
          config,
          applicationConfig,
          workers,
          health,
          currentWorkers,
          currentHealth
        )
        report.push({
          application: applicationId,
          workers: r.workers,
          health: r.health
        })
      } else if (health) {
        const r = await this.#updateApplicationHealth(
          applicationId,
          config,
          applicationConfig,
          currentWorkers,
          currentHealth,
          health
        )
        report.push({
          application: applicationId,
          health: r.health
        })
      } else if (workers) {
        const r = await this.#updateApplicationWorkers(
          applicationId,
          config,
          applicationConfig,
          workers,
          currentWorkers
        )
        report.push({
          application: applicationId,
          workers: r.workers
        })
      }
    }

    return report
  }

  setConcurrency (concurrency) {
    this.#concurrency = concurrency
  }

  getRoot () {
    return this.#root
  }

  getUrl () {
    return this.#url
  }

  getRuntimeStatus () {
    return this.#status
  }

  async getRuntimeMetadata () {
    const packageJson = await this.#getRuntimePackageJson()
    const entrypointDetails = await this.getEntrypointDetails()

    return {
      pid: process.pid,
      cwd: process.cwd(),
      argv: process.argv,
      uptimeSeconds: Math.floor(process.uptime()),
      execPath: process.execPath,
      nodeVersion: process.version,
      projectDir: this.#root,
      packageName: packageJson.name ?? null,
      packageVersion: packageJson.version ?? null,
      url: entrypointDetails?.url ?? null,
      platformaticVersion: version
    }
  }

  getRuntimeEnv () {
    return this.#env
  }

  getRuntimeConfig (includeMeta = false) {
    if (includeMeta) {
      return this.#config
    }

    const { [kMetadata]: _, ...config } = this.#config
    return config
  }

  getInterceptor () {
    return this.#meshInterceptor
  }

  getDispatcher () {
    return this.#dispatcher
  }

  getManagementApi () {
    return this.#managementApi
  }

  getManagementApiUrl () {
    return this.#managementApi?.server.address() ?? null
  }

  async getEntrypointDetails () {
    return this.getApplicationDetails(this.#entrypointId)
  }

  async getCustomHealthChecks () {
    const invocations = []

    for (const id of this.#applications.keys()) {
      const workersIds = this.#workers.getKeys(id)
      for (const workerId of workersIds) {
        invocations.push([workerId, this.#workers.get(workerId)])
      }
    }

    return sendMultipleViaITC(
      invocations,
      'getCustomHealthCheck',
      undefined,
      [],
      this.#concurrency,
      this.#config.metrics.healthChecksTimeout,
      {}
    )
  }

  async getCustomReadinessChecks () {
    const invocations = []

    for (const id of this.#applications.keys()) {
      const workersIds = this.#workers.getKeys(id)
      for (const workerId of workersIds) {
        invocations.push([workerId, this.#workers.get(workerId)])
      }
    }

    return sendMultipleViaITC(
      invocations,
      'getCustomReadinessCheck',
      undefined,
      [],
      this.#concurrency,
      this.#config.metrics.healthChecksTimeout,
      {}
    )
  }

  async getMetrics (format = 'json') {
    let metrics = null

    // Get process-level metrics once from main thread registry (if available)
    let processMetricsJson = null
    if (this.#processMetricsRegistry) {
      processMetricsJson = await this.#processMetricsRegistry.getMetricsAsJSON()
    }

    for (const worker of this.#workers.values()) {
      try {
        // The application might be temporarily unavailable
        if (worker[kWorkerStatus] !== 'started') {
          continue
        }

        // Get thread-specific metrics from worker
        const applicationMetrics = await executeWithTimeout(
          sendViaITC(worker, 'getMetrics', format),
          this.#config.metrics?.timeout ?? 10000
        )

        if (applicationMetrics && applicationMetrics !== kTimeout) {
          if (metrics === null) {
            metrics = format === 'json' ? [] : ''
          }

          // Build worker labels including custom labels from metrics config
          const workerLabels = {
            ...this.#config.metrics?.labels,
            [this.#metricsLabelName]: worker[kApplicationId]
          }
          const workerId = worker[kWorkerId]
          if (workerId >= 0) {
            workerLabels.workerId = workerId
          }

          if (format === 'json') {
            // Duplicate process metrics with worker labels and add to output
            if (processMetricsJson) {
              this.#applyLabelsToMetrics(processMetricsJson, workerLabels, metrics)
            }
            // Add worker's thread-specific metrics
            for (let i = 0; i < applicationMetrics.length; i++) {
              metrics.push(applicationMetrics[i])
            }
          } else {
            // Text format: format process metrics with worker labels
            if (processMetricsJson) {
              metrics += this.#formatProcessMetricsText(processMetricsJson, workerLabels)
            }
            metrics += applicationMetrics
          }
        }
      } catch (e) {
        // The application exited while we were sending the ITC, skip it
        if (
          e.code === 'PLT_RUNTIME_APPLICATION_NOT_STARTED' ||
          e.code === 'PLT_RUNTIME_APPLICATION_EXIT' ||
          e.code === 'PLT_RUNTIME_APPLICATION_WORKER_EXIT'
        ) {
          continue
        }

        throw e
      }
    }

    return { metrics }
  }

  // Apply labels to process metrics and push to output array (for JSON format)
  #applyLabelsToMetrics (processMetrics, labels, outputArray) {
    for (let i = 0; i < processMetrics.length; i++) {
      const metric = processMetrics[i]
      const newValues = []
      const values = metric.values
      for (let j = 0; j < values.length; j++) {
        const v = values[j]
        newValues.push({
          value: v.value,
          labels: { ...labels, ...v.labels },
          metricName: v.metricName
        })
      }
      outputArray.push({
        name: metric.name,
        help: metric.help,
        type: metric.type,
        aggregator: metric.aggregator,
        values: newValues
      })
    }
  }

  // Format process metrics as Prometheus text format with labels
  #formatProcessMetricsText (processMetricsJson, labels) {
    let output = ''

    for (let i = 0; i < processMetricsJson.length; i++) {
      const metric = processMetricsJson[i]
      const name = metric.name
      const help = metric.help
      const type = metric.type

      // Add HELP and TYPE lines
      output += `# HELP ${name} ${help}\n`
      output += `# TYPE ${name} ${type}\n`

      const values = metric.values
      for (let j = 0; j < values.length; j++) {
        const v = values[j]
        const combinedLabels = { ...labels, ...v.labels }
        const labelParts = []

        for (const [key, val] of Object.entries(combinedLabels)) {
          // Escape label values for Prometheus format
          const escapedVal = String(val).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')
          labelParts.push(`${key}="${escapedVal}"`)
        }

        const labelStr = labelParts.length > 0 ? `{${labelParts.join(',')}}` : ''
        const metricName = v.metricName || name
        output += `${metricName}${labelStr} ${v.value}\n`
      }
    }

    return output
  }

  async getFormattedMetrics () {
    try {
      const { metrics } = await this.getMetrics()

      if (metrics === null || metrics.length === 0) {
        return null
      }

      const metricsNames = [
        'process_cpu_percent_usage',
        'process_resident_memory_bytes',
        'nodejs_heap_size_total_bytes',
        'nodejs_heap_size_used_bytes',
        'nodejs_heap_space_size_total_bytes',
        'nodejs_eventloop_utilization',
        'http_request_all_summary_seconds'
      ]

      const applicationsMetrics = {}

      for (const metric of metrics) {
        const { name, values } = metric

        if (!metricsNames.includes(name)) continue
        if (!values || values.length === 0) continue

        const labels = values[0].labels
        // Use the configured label name (serviceId for v2 compatibility, applicationId for v3+)
        const applicationId = labels?.[this.#metricsLabelName]

        if (!applicationId) {
          throw new Error(`Missing ${this.#metricsLabelName} label in metrics`)
        }

        let applicationMetrics = applicationsMetrics[applicationId]
        if (!applicationMetrics) {
          applicationMetrics = {
            cpu: 0,
            rss: 0,
            totalHeapSize: 0,
            usedHeapSize: 0,
            newSpaceSize: 0,
            oldSpaceSize: 0,
            elu: 0,
            latency: {
              p50: 0,
              p90: 0,
              p95: 0,
              p99: 0
            }
          }
          applicationsMetrics[applicationId] = applicationMetrics
        }

        parsePromMetric(applicationMetrics, metric)
      }

      function parsePromMetric (applicationMetrics, promMetric) {
        const { name } = promMetric

        if (name === 'process_cpu_percent_usage') {
          applicationMetrics.cpu = promMetric.values[0].value
          return
        }
        if (name === 'process_resident_memory_bytes') {
          applicationMetrics.rss = promMetric.values[0].value
          return
        }
        if (name === 'nodejs_heap_size_total_bytes') {
          applicationMetrics.totalHeapSize = promMetric.values[0].value
          return
        }
        if (name === 'nodejs_heap_size_used_bytes') {
          applicationMetrics.usedHeapSize = promMetric.values[0].value
          return
        }
        if (name === 'nodejs_heap_space_size_total_bytes') {
          const newSpaceSize = promMetric.values.find(value => value.labels.space === 'new')
          const oldSpaceSize = promMetric.values.find(value => value.labels.space === 'old')

          applicationMetrics.newSpaceSize = newSpaceSize.value
          applicationMetrics.oldSpaceSize = oldSpaceSize.value
          return
        }
        if (name === 'nodejs_eventloop_utilization') {
          applicationMetrics.elu = promMetric.values[0].value
          return
        }
        if (name === 'http_request_all_summary_seconds') {
          applicationMetrics.latency = {
            p50: promMetric.values.find(value => value.labels.quantile === 0.5)?.value || 0,
            p90: promMetric.values.find(value => value.labels.quantile === 0.9)?.value || 0,
            p95: promMetric.values.find(value => value.labels.quantile === 0.95)?.value || 0,
            p99: promMetric.values.find(value => value.labels.quantile === 0.99)?.value || 0
          }
        }
      }

      return {
        version: 1,
        date: new Date().toISOString(),
        applications: applicationsMetrics
      }
    } catch (err) {
      // If any metric is missing, return nothing
      this.logger.warn({ err }, 'Cannot fetch metrics')

      return null
    }
  }

  getSharedContext () {
    return this.#sharedContext
  }

  async getApplicationResourcesInfo (id) {
    const workersCount = this.#workers.getKeys(id).length
    const worker = await this.#getWorkerByIdOrNext(id, 0, false, false)
    const health = worker[kConfig].health

    return { workers: workersCount, health }
  }

  getApplicationsIds () {
    return Array.from(this.#applications.keys())
  }

  async getApplications (allowUnloaded = false) {
    return {
      entrypoint: this.#entrypointId,
      production: this.#isProduction,
      applications: await Promise.all(
        this.getApplicationsIds().map(id => this.getApplicationDetails(id, allowUnloaded))
      )
    }
  }

  async getApplicationMeta (id) {
    const application = await this.#getApplicationById(id)

    try {
      return await sendViaITC(application, 'getApplicationMeta')
    } catch (e) {
      // The application exports no meta, return an empty object
      if (e.code === 'PLT_ITC_HANDLER_NOT_FOUND') {
        return {}
      }

      throw e
    }
  }

  async getApplicationDetails (id, allowUnloaded = false) {
    let application

    try {
      application = await this.#getApplicationById(id)
    } catch (e) {
      if (allowUnloaded) {
        return { id, status: 'stopped' }
      }

      throw e
    }

    const { entrypoint, localUrl, config, path } = application[kConfig]

    const sourceMaps = application[kConfig].sourceMaps ?? this.#config.sourceMaps
    const status = await sendViaITC(application, 'getStatus')
    const { type, version, dependencies } = await sendViaITC(application, 'getApplicationInfo')

    const applicationDetails = {
      id,
      type,
      config,
      path,
      status,
      dependencies,
      version,
      localUrl,
      entrypoint,
      sourceMaps
    }

    if (this.#isProduction) {
      applicationDetails.workers = this.#workers.getKeys(id).length
    }

    if (entrypoint) {
      applicationDetails.url = status === 'started' ? this.#url : null
    }

    return applicationDetails
  }

  async getApplication (id, ensureStarted = true) {
    return this.#getApplicationById(id, ensureStarted)
  }

  async getApplicationConfig (id, ensureStarted = true) {
    const application = await this.#getApplicationById(id, ensureStarted)

    return sendViaITC(application, 'getApplicationConfig')
  }

  async getApplicationEnv (id, ensureStarted = true) {
    const application = await this.#getApplicationById(id, ensureStarted)

    return sendViaITC(application, 'getApplicationEnv')
  }

  async getApplicationOpenapiSchema (id) {
    const application = await this.#getApplicationById(id, true)

    return sendViaITC(application, 'getApplicationOpenAPISchema')
  }

  async getApplicationGraphqlSchema (id) {
    const application = await this.#getApplicationById(id, true)

    return sendViaITC(application, 'getApplicationGraphQLSchema')
  }

  async getWorkers (includeRaw = false) {
    const status = {}

    for (const [key, worker] of this.#workers.entries()) {
      const [application, index] = key.split(':')

      status[key] = {
        application,
        worker: index,
        status: worker[kWorkerStatus],
        thread: worker.threadId,
        raw: includeRaw ? worker : undefined
      }
    }

    return status
  }

  async getWorkerHealth (worker, options = {}) {
    const currentELU = worker.performance.eventLoopUtilization()
    const previousELU = options.previousELU

    let elu = currentELU
    if (previousELU) {
      elu = worker.performance.eventLoopUtilization(elu, previousELU)
    }

    if (!features.node.worker.getHeapStatistics) {
      return { elu: elu.utilization, currentELU }
    }

    // Only check heap statistics every 60 health checks (once per minute)
    const counter = (worker[kHeapCheckCounter] ?? 0) + 1
    worker[kHeapCheckCounter] = counter >= 60 ? 0 : counter

    if (counter >= 60 || !worker[kLastHeapStats]) {
      const { used_heap_size: heapUsed, total_heap_size: heapTotal } = await worker.getHeapStatistics()
      worker[kLastHeapStats] = { heapUsed, heapTotal }
    }

    const { heapUsed, heapTotal } = worker[kLastHeapStats]
    return { elu: elu.utilization, heapUsed, heapTotal, currentELU }
  }

  getDynamicWorkersScaler () {
    return this.#dynamicWorkersScaler
  }

  #getHttpCacheValue ({ request }) {
    if (!this.#sharedHttpCache) {
      return
    }

    return this.#sharedHttpCache.getValue(request)
  }

  #setHttpCacheValue ({ request, response, payload }) {
    if (!this.#sharedHttpCache) {
      return
    }

    return this.#sharedHttpCache.setValue(request, response, payload)
  }

  #deleteHttpCacheValue ({ request }) {
    if (!this.#sharedHttpCache) {
      return
    }

    return this.#sharedHttpCache.delete(request)
  }

  async #setDispatcher (undiciConfig) {
    const config = this.#config

    const dispatcherOpts = { ...undiciConfig }
    const interceptors = [this.#meshInterceptor]

    if (config.httpCache) {
      this.#sharedHttpCache = await createSharedStore(this.#root, config.httpCache)
      interceptors.push(
        undiciInterceptors.cache({
          store: this.#sharedHttpCache,
          methods: config.httpCache.methods ?? ['GET', 'HEAD'],
          origins: parseOrigins(config.httpCache.origins),
          cacheByDefault: config.httpCache.cacheByDefault,
          type: config.httpCache.type
        })
      )
    }
    this.#dispatcher = new Agent(dispatcherOpts).compose(interceptors)
  }

  #updateStatus (status, args) {
    this.#status = status
    this.emitAndNotify(status, args)
  }

  #showUrl () {
    this.logger.info(`Platformatic is now listening at ${this.#url}`)
  }

  async #setupApplication (applicationConfig) {
    if (this.#status === 'stopping' || this.#status === 'closed') {
      return
    }

    const id = applicationConfig.id
    const config = this.#config

    if (!applicationConfig.path) {
      // If there is no application path, check if the application was resolved
      if (applicationConfig.url) {
        // Try to backfill the path for external applications
        applicationConfig.path = join(this.#root, config.resolvedApplicationsBasePath, id)

        if (!existsSync(applicationConfig.path)) {
          const executable = globalThis.platformatic?.executable ?? 'platformatic'
          this.logger.error(
            `The path for application "%s" does not exist. Please run "${executable} resolve" and try again.`,
            id
          )

          await this.closeAndThrow(new RuntimeAbortedError())
        }
      } else {
        this.logger.error(
          'The application "%s" has no path defined. Please check your configuration and try again.',
          id
        )

        await this.closeAndThrow(new RuntimeAbortedError())
      }
    }

    const workers = applicationConfig.workers.static
    const setupInvocations = []

    for (let i = 0; i < workers; i++) {
      setupInvocations.push([config, applicationConfig, workers, id, i])
    }

    await executeInParallel(this.#setupWorker.bind(this), setupInvocations, this.#concurrency)

    await this.#dynamicWorkersScaler?.add(applicationConfig)
    this.emitAndNotify('application:init', id)
  }

  async #setupWorker (config, applicationConfig, workersCount, applicationId, index, enabled = true, attempt = 0) {
    const { restartOnError } = config
    const workerId = `${applicationId}:${index}`

    // Handle inspector
    let inspectorOptions

    if (this.#config.inspectorOptions) {
      inspectorOptions = {
        ...this.#config.inspectorOptions
      }

      inspectorOptions.port = inspectorOptions.port + this.#workers.size + 1
    }

    if (config.telemetry) {
      applicationConfig.telemetry = {
        ...config.telemetry,
        ...applicationConfig.telemetry,
        applicationName: `${config.telemetry.applicationName}-${applicationConfig.id}`
      }
    }

    const errorLabel = this.#workerExtendedLabel(applicationId, index, workersCount)
    const health = deepmerge(config.health ?? {}, applicationConfig.health ?? {})

    const execArgv = applicationConfig.execArgv ?? []

    if (!applicationConfig.skipTelemetryHooks && config.telemetry && config.telemetry.enabled !== false) {
      const require = createRequire(import.meta.url)
      const telemetryPath = require.resolve('@platformatic/telemetry')
      const openTelemetrySetupPath = join(telemetryPath, '..', 'lib', 'node-telemetry.js')
      const hookUrl = pathToFileURL(require.resolve('@opentelemetry/instrumentation/hook.mjs'))

      // We need the following because otherwise some open telemetry instrumentations won't work with ESM (like express)
      // see: https://github.com/open-telemetry/opentelemetry-js/blob/main/doc/esm-support.md#instrumentation-hook-required-for-esm
      execArgv.push('--import', `data:text/javascript, import { register } from 'node:module'; register('${hookUrl}')`)
      execArgv.push('--import', pathToFileURL(openTelemetrySetupPath))
    }

    if ((applicationConfig.sourceMaps ?? config.sourceMaps) === true) {
      execArgv.push('--enable-source-maps')
    }

    if (applicationConfig.permissions?.fs) {
      execArgv.push(...this.#setupPermissions(applicationConfig))
    }

    let preload = config.preload
    if (execArgv.includes('--permission')) {
      // Remove wattpm-pprof-capture from preload since it is not supported
      const pprofCapturePath = pprofCapturePreloadPath()
      preload = preload.filter(p => p !== pprofCapturePath)
    }

    const workerEnv = structuredClone(this.#env)

    if (applicationConfig.nodeOptions?.trim().length > 0) {
      const originalNodeOptions = workerEnv.NODE_OPTIONS ?? ''

      workerEnv.NODE_OPTIONS = `${originalNodeOptions} ${applicationConfig.nodeOptions}`.trim()
    }

    const maxHeapTotal =
      typeof health.maxHeapTotal === 'string' ? parseMemorySize(health.maxHeapTotal) : health.maxHeapTotal
    const maxYoungGeneration =
      typeof health.maxYoungGeneration === 'string'
        ? parseMemorySize(health.maxYoungGeneration)
        : health.maxYoungGeneration
    const codeRangeSize =
      typeof health.codeRangeSize === 'string' ? parseMemorySize(health.codeRangeSize) : health.codeRangeSize

    const maxOldGenerationSizeMb = Math.floor(
      (maxYoungGeneration > 0 ? maxHeapTotal - maxYoungGeneration : maxHeapTotal) / (1024 * 1024)
    )
    const maxYoungGenerationSizeMb = maxYoungGeneration ? Math.floor(maxYoungGeneration / (1024 * 1024)) : undefined
    const codeRangeSizeMb = codeRangeSize ? Math.floor(codeRangeSize / (1024 * 1024)) : undefined

    const worker = new Worker(kWorkerFile, {
      workerData: {
        config: {
          ...config,
          preload
        },
        applicationConfig: {
          ...applicationConfig,
          isProduction: this.#isProduction,
          configPatch: this.#applicationsConfigsPatches.get(applicationId)
        },
        worker: {
          id: workerId,
          index,
          count: workersCount
        },
        inspectorOptions,
        dirname: this.#root
      },
      argv: applicationConfig.arguments,
      execArgv,
      env: workerEnv,
      resourceLimits: {
        maxOldGenerationSizeMb,
        maxYoungGenerationSizeMb,
        codeRangeSizeMb
      },
      stdout: true,
      stderr: true,
      name: workerId
    })

    this.#handleWorkerStandardStreams(worker, applicationId, index)

    // Make sure the listener can handle a lot of API requests at once before raising a warning
    worker.setMaxListeners(1e3)

    // Track application exiting
    const eventPayload = { application: applicationId, worker: index, workersCount }

    worker.once('exit', code => {
      if (worker[kWorkerStatus] === 'exited') {
        return
      }

      const started = worker[kWorkerStatus] === 'started'
      worker[kWorkerStatus] = 'exited'
      this.emitAndNotify('application:worker:exited', eventPayload)

      this.#cleanupWorker(worker)

      if (this.#status === 'stopping') {
        return
      }

      // Wait for the next tick so that crashed from the thread are logged first
      setImmediate(() => {
        if (started && (!config.watch || code !== 0)) {
          this.emitAndNotify('application:worker:error', { ...eventPayload, code })
          this.#broadcastWorkers()

          this.logger.warn(`The ${errorLabel} unexpectedly exited with code ${code}.`)
        }

        // Restart the application if it was started
        if (started && this.#status === 'started') {
          if (restartOnError > 0) {
            if (restartOnError < IMMEDIATE_RESTART_MAX_THRESHOLD) {
              this.logger.warn(`The ${errorLabel} is being restarted ...`)
            } else {
              this.logger.warn(`The ${errorLabel} will be restarted in ${restartOnError}ms ...`)
            }

            this.#restartCrashedWorker(config, applicationConfig, workersCount, applicationId, index, false, 0).catch(
              err => {
                this.logger.error({ err: ensureLoggableError(err) }, `${errorLabel} could not be restarted.`)
              }
            )
          } else {
            this.emitAndNotify('application:worker:unvailable', eventPayload)
            this.logger.warn(`The ${errorLabel} is no longer available.`)
          }
        }
      })
    })

    worker[kId] = workerId
    worker[kFullId] = workerId
    worker[kApplicationId] = applicationId
    worker[kWorkerId] = index
    worker[kWorkerStatus] = 'boot'

    if (inspectorOptions) {
      worker[kInspectorOptions] = {
        port: inspectorOptions.port,
        id: applicationId,
        dirname: this.#root
      }
    }

    // Setup ITC
    worker[kITC] = new ITC({
      name: workerId + '-runtime',
      port: worker,
      handlers: this.#workerITCHandlers
    })
    worker[kITC].listen()

    // Forward events from the worker
    // Do not use emitAndNotify here since we don't want to forward unknown events
    worker[kITC].on('event', ({ event, payload }) => {
      event = `application:worker:event:${event}`

      this.emit(event, ...payload, workerId, applicationId, index)
      this.logger.trace({ event, payload, id: workerId, application: applicationId, worker: index }, 'Runtime event')
    })

    worker[kITC].on('request:restart', async () => {
      try {
        await this.restartApplication(applicationId)
      } catch (e) {
        this.logger.error(e)
      }
    })

    // Only activate watch for the first instance
    if (index === 0) {
      // Handle applications changes
      // This is not purposely activated on when this.#config.watch === true
      // so that applications can eventually manually trigger a restart. This mechanism is current
      // used by the gateway.
      worker[kITC].on('changed', async () => {
        this.emitAndNotify('application:worker:changed', eventPayload)

        try {
          const wasStarted = worker[kWorkerStatus].startsWith('start')
          await this.stopApplication(applicationId)

          if (wasStarted) {
            await this.startApplication(applicationId)
          }

          this.logger.info(`The application "${applicationId}" has been successfully reloaded.`)
          this.emitAndNotify('application:worker:reloaded', eventPayload)

          if (applicationConfig.entrypoint) {
            this.#showUrl()
          }
        } catch (e) {
          this.logger.error(e)
        }
      })
    }

    if (enabled) {
      // Store locally
      this.#workers.set(workerId, worker)
    }

    // Setup the interceptor
    // kInterceptorReadyPromise resolves when the worker
    // is ready to receive requests: after calling the replaceServer method
    worker[kInterceptorReadyPromise] = this.#meshInterceptor.route(applicationId, worker)

    // Wait for initialization
    try {
      await waitEventFromITC(worker, 'init')
    } catch (e) {
      if (attempt === MAX_BOOTSTRAP_ATTEMPTS) {
        const error = new RuntimeAbortedError({ cause: e })
        error.message = `Unable to initialize the ${errorLabel}.`
        throw e
      }

      if (e.code !== 'PLT_RUNTIME_APPLICATION_WORKER_EXIT') {
        this.logger.error(
          { err: ensureLoggableError(e) },
          `Failed to initialize the ${errorLabel}. Attempting to initialize a new worker ...`
        )
      }

      this.#workers.delete(workerId)
      return this.#setupWorker(config, applicationConfig, workersCount, applicationId, index, enabled, attempt + 1)
    }

    if (applicationConfig.entrypoint) {
      this.#entrypointId = applicationId
    }

    worker[kConfig] = { ...applicationConfig, health, workers: workersCount }
    worker[kWorkerStatus] = 'init'
    this.emitAndNotify('application:worker:init', eventPayload)

    return worker
  }

  #startHealthMetricsCollectionIfNeeded () {
    // Need health metrics if dynamic workers scaler exists (for vertical scaling)
    // or if any worker has health checks enabled
    let needsHealthMetrics = !!this.#dynamicWorkersScaler

    if (!needsHealthMetrics) {
      // Check if any worker has health checks enabled
      for (const worker of this.#workers.values()) {
        const healthConfig = worker[kConfig]?.health
        if (healthConfig?.enabled && this.#config.restartOnError > 0) {
          needsHealthMetrics = true
          break
        }
      }
    }

    if (needsHealthMetrics) {
      this.#startHealthMetricsCollection()
    }
  }

  #startHealthMetricsCollection () {
    const collectHealthMetrics = async () => {
      if (this.#status !== 'started') {
        return
      }

      // Iterate through all workers and collect health metrics
      for (const worker of this.#workers.values()) {
        if (worker[kWorkerStatus] !== 'started') {
          continue
        }

        const id = worker[kApplicationId]
        const index = worker[kWorkerId]
        const errorLabel = this.#workerExtendedLabel(id, index, worker[kConfig].workers)

        let health = null
        try {
          health = await this.getWorkerHealth(worker, {
            previousELU: worker[kLastHealthCheckELU]
          })
        } catch (err) {
          this.logger.error({ err }, `Failed to get health for ${errorLabel}.`)
        } finally {
          worker[kLastHealthCheckELU] = health?.currentELU ?? null
        }

        const healthSignals = worker[kWorkerHealthSignals]?.getAll() ?? []

        // We use emit instead of emitAndNotify to avoid sending a postMessages
        // to each workers even if they are not interested in health metrics.
        // No one of the known capabilities use this event yet.
        this.emit('application:worker:health:metrics', {
          id: worker[kId],
          application: id,
          worker: index,
          currentHealth: health,
          healthSignals
        })
      }

      // Reschedule the next check. We are not using .refresh() because it's more
      // expensive (weird).
      this.#healthMetricsTimer = setTimeout(collectHealthMetrics, 1000).unref()
    }

    // Start the collection
    this.#healthMetricsTimer = setTimeout(collectHealthMetrics, 1000).unref()
  }

  #setupHealthCheck (config, applicationConfig, workersCount, id, index, worker, errorLabel) {
    let healthMetricsListener = null

    // Clear the timeout and listener when exiting
    worker.on('exit', () => {
      clearTimeout(worker[kHealthCheckTimer])
      if (healthMetricsListener) {
        this.removeListener('application:worker:health:metrics', healthMetricsListener)
      }
    })

    const healthConfig = worker[kConfig].health

    let { maxELU, maxHeapUsed, maxHeapTotal, maxUnhealthyChecks, interval } = worker[kConfig].health

    if (typeof maxHeapTotal === 'string') {
      maxHeapTotal = parseMemorySize(maxHeapTotal)
    }

    if (interval < 1000) {
      interval = 1000
      this.logger.warn(
        `The health check interval for the "${errorLabel}" is set to ${healthConfig.interval}ms. ` +
          'The minimum health check interval is 1s. It will be set to 1000ms.'
      )
    }

    let lastHealthMetrics = null

    healthMetricsListener = healthCheck => {
      if (healthCheck.id === worker[kId]) {
        lastHealthMetrics = healthCheck
      }
    }

    this.on('application:worker:health:metrics', healthMetricsListener)

    let unhealthyChecks = 0

    worker[kHealthCheckTimer] = setTimeout(async () => {
      if (worker[kWorkerStatus] !== 'started') return

      if (lastHealthMetrics) {
        const health = lastHealthMetrics.currentHealth
        const memoryUsage = health.heapUsed / maxHeapTotal
        const unhealthy = health.elu > maxELU || memoryUsage > maxHeapUsed

        this.emit('application:worker:health', {
          id: worker[kId],
          application: id,
          worker: index,
          currentHealth: health,
          unhealthy,
          healthConfig
        })

        if (health.elu > maxELU) {
          this.logger.error(
            `The ${errorLabel} has an ELU of ${(health.elu * 100).toFixed(2)} %, ` +
              `above the maximum allowed usage of ${(maxELU * 100).toFixed(2)} %.`
          )
        }

        if (memoryUsage > maxHeapUsed) {
          this.logger.error(
            `The ${errorLabel} is using ${(memoryUsage * 100).toFixed(2)} % of the memory, ` +
              `above the maximum allowed usage of ${(maxHeapUsed * 100).toFixed(2)} %.`
          )
        }

        if (unhealthy) {
          unhealthyChecks++
        } else {
          unhealthyChecks = 0
        }

        if (unhealthyChecks === maxUnhealthyChecks) {
          try {
            this.emitAndNotify('application:worker:unhealthy', { application: id, worker: index })

            this.logger.error(
              { elu: health.elu, maxELU, memoryUsage: health.heapUsed, maxMemoryUsage: maxHeapUsed },
              `The ${errorLabel} is unhealthy. Replacing it ...`
            )

            await this.#replaceWorker(config, applicationConfig, workersCount, id, index, worker)
          } catch (e) {
            this.logger.error(
              { elu: health.elu, maxELU, memoryUsage: health.heapUsed, maxMemoryUsage: maxHeapUsed },
              `Cannot replace the ${errorLabel}. Forcefully terminating it ...`
            )

            worker.terminate()
          }
        } else {
          worker[kHealthCheckTimer].refresh()
        }
      }
    }, interval).unref()
  }

  async #startWorker (
    config,
    applicationConfig,
    workersCount,
    id,
    index,
    silent,
    bootstrapAttempt = 0,
    worker = undefined,
    disableRestartAttempts = false
  ) {
    const label = this.#workerExtendedLabel(id, index, workersCount)

    if (!silent) {
      this.logger.info(`Starting the ${label}...`)
    }

    if (!worker) {
      worker = await this.#getWorkerByIdOrNext(id, index, false, false)
    }

    const eventPayload = { application: id, worker: index, workersCount }

    // The application was stopped, recreate the thread
    if (!worker) {
      await this.#setupApplication(applicationConfig, index)
      worker = await this.#getWorkerByIdOrNext(id, index)
    }

    worker[kWorkerStatus] = 'starting'
    this.emitAndNotify('application:worker:starting', eventPayload)

    try {
      let workerUrl
      if (config.startTimeout > 0) {
        workerUrl = await executeWithTimeout(sendViaITC(worker, 'start'), config.startTimeout)

        if (workerUrl === kTimeout) {
          this.emitAndNotify('application:worker:startTimeout', eventPayload)
          this.logger.error(`The ${label} failed to start in ${config.startTimeout}ms. Forcefully killing the thread.`)
          worker.terminate()
          throw new ApplicationStartTimeoutError(id, config.startTimeout)
        }
      } else {
        workerUrl = await sendViaITC(worker, 'start')
      }

      await this.#avoidOutOfOrderThreadLogs()

      if (workerUrl) {
        this.#url = workerUrl
      }

      // Wait for the interceptor to be ready
      const interceptorResult = await executeWithTimeout(worker[kInterceptorReadyPromise], config.startTimeout)
      if (interceptorResult === kTimeout) {
        throw new WorkerInterceptorJoinTimeoutError(label, config.startTimeout)
      }

      worker[kWorkerStatus] = 'started'
      worker[kWorkerStartTime] = Date.now()

      this.emitAndNotify('application:worker:started', eventPayload)
      this.#broadcastWorkers()

      if (!silent) {
        this.logger.info(`Started the ${label}...`)
      }

      const { enabled, gracePeriod } = worker[kConfig].health
      if (enabled && config.restartOnError > 0) {
        // if gracePeriod is 0, it will be set to 1 to start health checks immediately
        // however, the health event will start when the worker is started
        setTimeout(
          () => {
            this.#setupHealthCheck(config, applicationConfig, workersCount, id, index, worker, label)
          },
          gracePeriod > 0 ? gracePeriod : 1
        ).unref()
      }
    } catch (err) {
      const error = ensureError(err)
      worker[kITC].notify('application:worker:start:processed')

      // TODO: handle port allocation error here
      if (error.code === 'EADDRINUSE' || error.code === 'EACCES') throw error

      this.#cleanupWorker(worker)

      if (worker[kWorkerStatus] !== 'exited') {
        // This prevent the exit handler to restart application
        worker[kWorkerStatus] = 'exited'

        // Wait for the worker to exit gracefully, otherwise we terminate it
        const waitTimeout = await executeWithTimeout(once(worker, 'exit'), config.gracefulShutdown.application)

        if (waitTimeout === kTimeout) {
          await worker.terminate()
        }
      }

      this.emitAndNotify('application:worker:start:error', { ...eventPayload, error })

      if (error.code !== 'PLT_RUNTIME_APPLICATION_START_TIMEOUT') {
        this.logger.error({ err: ensureLoggableError(error) }, `Failed to start ${label}: ${error.message}`)
      }

      const restartOnError = config.restartOnError

      if (disableRestartAttempts || !restartOnError) {
        throw error
      }

      if (bootstrapAttempt++ >= MAX_BOOTSTRAP_ATTEMPTS || restartOnError === 0) {
        this.logger.error(`Failed to start ${label} after ${MAX_BOOTSTRAP_ATTEMPTS} attempts.`)
        this.emitAndNotify('application:worker:start:failed', { ...eventPayload, error })
        throw error
      }

      if (restartOnError < IMMEDIATE_RESTART_MAX_THRESHOLD) {
        this.logger.warn(
          `Performing attempt ${bootstrapAttempt} of ${MAX_BOOTSTRAP_ATTEMPTS} to start the ${label} again ...`
        )
      } else {
        this.logger.warn(
          `Attempt ${bootstrapAttempt} of ${MAX_BOOTSTRAP_ATTEMPTS} to start the ${label} again will be performed in ${restartOnError}ms ...`
        )
      }

      await this.#restartCrashedWorker(config, applicationConfig, workersCount, id, index, silent, bootstrapAttempt)
    }
  }

  async #stopWorker (workersCount, id, index, silent, worker, dependents) {
    if (!worker) {
      worker = await this.#getWorkerByIdOrNext(id, index, false, false)
    }

    if (!worker) {
      return
    }

    // Boot should be aborted, discard the worker
    if (worker[kWorkerStatus] === 'boot') {
      return this.#discardWorker(worker)
    }

    const eventPayload = { application: id, worker: index, workersCount }

    worker[kWorkerStatus] = 'stopping'
    worker[kITC].removeAllListeners('changed')
    this.emitAndNotify('application:worker:stopping', eventPayload)

    const label = this.#workerExtendedLabel(id, index, workersCount)

    if (!silent) {
      this.logger.info(`Stopping the ${label}...`)
    }

    const exitTimeout = this.#config.gracefulShutdown.application
    const exitPromise = once(worker, 'exit')

    // Always send the stop message, it will shut down workers that only had ITC and interceptors setup
    try {
      await executeWithTimeout(sendViaITC(worker, 'stop', { force: !!this.error, dependents }), exitTimeout)
    } catch (error) {
      this.emitAndNotify('application:worker:stop:error', eventPayload)
      this.logger.info({ error: ensureLoggableError(error) }, `Failed to stop ${label}. Killing a worker thread.`)
    } finally {
      worker[kITC].notify('application:worker:stop:processed')
      // Wait for the processed message to be received
      await sleep(1)

      worker[kITC].close()
    }

    if (!silent) {
      this.logger.info(`Stopped the ${label}...`)
    }

    // Wait for the worker thread to finish, we're going to create a new one if the application is ever restarted
    const res = await executeWithTimeout(exitPromise, exitTimeout)

    // If the worker didn't exit in time, kill it
    if (res === kTimeout) {
      this.emitAndNotify('application:worker:exit:timeout', eventPayload)
      await worker.terminate()
    }

    await this.#avoidOutOfOrderThreadLogs()

    worker[kWorkerStatus] = 'stopped'
    this.emitAndNotify('application:worker:stopped', eventPayload)
    this.#broadcastWorkers()
  }

  #cleanupWorker (worker) {
    clearTimeout(worker[kHealthCheckTimer])

    const currentWorker = this.#workers.get(worker[kFullId])

    if (currentWorker === worker) {
      this.#workers.delete(worker[kFullId])
    }

    worker[kITC].close()
  }

  async #discardWorker (worker) {
    await this.#meshInterceptor.unroute(worker[kApplicationId], worker, true)
    worker.removeAllListeners('exit')
    await worker.terminate()

    return this.#cleanupWorker(worker)
  }

  #workerExtendedLabel (applicationId, workerId, _workersCount) {
    return `worker ${workerId} of the application "${applicationId}"`
  }

  async #restartCrashedWorker (config, applicationConfig, workersCount, id, index, silent, bootstrapAttempt) {
    const workerId = `${id}:${index}`

    let restartPromise = this.#restartingWorkers.get(workerId)
    if (restartPromise) {
      await restartPromise
      return
    }

    restartPromise = new Promise((resolve, reject) => {
      async function restart () {
        this.#restartingWorkers.delete(workerId)

        // If some processes were scheduled to restart
        // but the runtime is stopped, ignore it
        if (!this.#status.startsWith('start')) {
          return
        }

        try {
          await this.#setupWorker(config, applicationConfig, workersCount, id, index)
          await this.#startWorker(config, applicationConfig, workersCount, id, index, silent, bootstrapAttempt)

          this.logger.info(
            `The ${this.#workerExtendedLabel(id, index, workersCount)} has been successfully restarted ...`
          )
          resolve()
        } catch (err) {
          // The runtime was stopped while the restart was happening, ignore any error.
          if (!this.#status.startsWith('start')) {
            resolve()
          }

          reject(err)
        }
      }

      if (config.restartOnError < IMMEDIATE_RESTART_MAX_THRESHOLD) {
        process.nextTick(restart.bind(this))
      } else {
        setTimeout(restart.bind(this), config.restartOnError)
      }
    })

    this.#restartingWorkers.set(workerId, restartPromise)
    await restartPromise
  }

  async #replaceWorker (config, applicationConfig, workersCount, applicationId, index, worker, silent) {
    const workerId = `${applicationId}:${index}`
    const label = this.#workerExtendedLabel(applicationId, index, workersCount)
    let newWorker

    const stopBeforeStart =
      applicationConfig.entrypoint &&
      (config.reuseTcpPorts === false || applicationConfig.reuseTcpPorts === false || !features.node.reusePort)

    if (stopBeforeStart) {
      await this.#removeWorker(workersCount, applicationId, index, worker, silent, label)
    }

    try {
      if (!silent) {
        this.logger.debug(`Preparing to start a replacement for ${label}  ...`)
      }

      // Create a new worker
      newWorker = await this.#setupWorker(config, applicationConfig, workersCount, applicationId, index, false)

      // Make sure the runtime hasn't been stopped in the meanwhile
      if (this.#status !== 'started') {
        return this.#discardWorker(newWorker)
      }

      // Add the worker to the mesh
      await this.#startWorker(config, applicationConfig, workersCount, applicationId, index, false, 0, newWorker, true)

      // Make sure the runtime hasn't been stopped in the meanwhile
      if (this.#status !== 'started') {
        return this.#discardWorker(newWorker)
      }

      this.#workers.set(workerId, newWorker)
    } catch (e) {
      newWorker?.terminate?.()
      throw e
    }

    if (!stopBeforeStart) {
      await this.#removeWorker(workersCount, applicationId, index, worker, silent, label)
    }
  }

  async #removeWorker (workersCount, applicationId, index, worker, silent, label) {
    if (!silent) {
      this.logger.debug(`Preparing to stop the old version of ${label} ...`)
    }

    // Remove the old worker and then kill it
    await sendViaITC(worker, 'removeFromMesh')

    // Stop the old worker to free the port
    await this.#stopWorker(workersCount, applicationId, index, false, worker, [])
  }

  async #getApplicationById (applicationId, ensureStarted = false, mustExist = true) {
    let workerId
    const matched = applicationId.match(/^(.+):(\d+)$/)

    if (matched) {
      applicationId = matched[1]
      workerId = matched[2]
    }

    if (!this.#applications.has(applicationId)) {
      throw new ApplicationNotFoundError(applicationId, this.getApplicationsIds().join(', '))
    }

    return this.#getWorkerByIdOrNext(applicationId, workerId, ensureStarted, mustExist)
  }

  // This method can work in two modes: when workerId is provided, it will return the specific worker
  // otherwise it will return the next available worker for the application.
  async #getWorkerByIdOrNext (applicationId, workerId, ensureStarted = false, mustExist = true) {
    let worker

    // Note that in this class "== null" is purposely used instead of "===" to check for both null and undefined
    if (workerId == null) {
      worker = this.#workers.next(applicationId)
    } else {
      worker = this.#workers.get(`${applicationId}:${workerId}`)
    }

    const applicationsIds = this.getApplicationsIds()

    if (!worker) {
      if (!mustExist && applicationsIds.includes(applicationId)) {
        return null
      }

      if (applicationsIds.includes(applicationId)) {
        const availableWorkers = this.#workers
          .getKeys(applicationId)
          .map(key => key.split(':')[1])
          .join(', ')
        throw new WorkerNotFoundError(workerId, applicationId, availableWorkers)
      } else {
        throw new ApplicationNotFoundError(applicationId, applicationsIds.join(', '))
      }
    }

    if (ensureStarted) {
      const applicationStatus = await sendViaITC(worker, 'getStatus')

      if (applicationStatus !== 'started') {
        throw new ApplicationNotStartedError(applicationId)
      }
    }

    return worker
  }

  async #createWorkersBroadcastChannel () {
    this.#workersBroadcastChannel?.close()
    this.#workersBroadcastChannel = new BroadcastChannel(kWorkersBroadcast)
  }

  async #broadcastWorkers () {
    const workers = new Map()

    // Create the list of workers
    for (const worker of this.#workers.values()) {
      if (worker[kWorkerStatus] !== 'started') {
        continue
      }

      const application = worker[kApplicationId]
      let applicationWorkers = workers.get(application)

      if (!applicationWorkers) {
        applicationWorkers = []
        workers.set(application, applicationWorkers)
      }

      applicationWorkers.push({
        id: worker[kId],
        application: worker[kApplicationId],
        worker: worker[kWorkerId],
        thread: worker.threadId
      })
    }

    try {
      this.#workersBroadcastChannel.postMessage(workers)
    } catch (err) {
      this.logger?.error({ err }, 'Error when broadcasting workers')
    }
  }

  async #getWorkerMessagingChannel ({ id, application, worker }, context) {
    if (this.#channelCreationHook?.(id, application) === false) {
      throw new MessagingError(
        application,
        `Communication channels are disabled between applications "${id}" and "${application}".`
      )
    }

    const target = await this.#getWorkerByIdOrNext(application, worker, true, true)

    const { port1, port2 } = new MessageChannel()

    // Send the first port to the target
    const response = await executeWithTimeout(
      sendViaITC(target, 'saveMessagingChannel', port1, [port1]),
      this.#config.messagingTimeout
    )

    if (response === kTimeout) {
      throw new MessagingError(application, 'Timeout while establishing a communication channel.')
    }

    context.transferList = [port2]
    this.emitAndNotify('application:worker:messagingChannel', { application, worker })
    return port2
  }

  async #getRuntimePackageJson () {
    const runtimeDir = this.#root
    const packageJsonPath = join(runtimeDir, 'package.json')
    const packageJsonFile = await readFile(packageJsonPath, 'utf8')
    const packageJson = JSON.parse(packageJsonFile)
    return packageJson
  }

  #handleWorkerStandardStreams (worker, applicationId, workerId) {
    const binding = { name: applicationId }

    if (typeof workerId !== 'undefined') {
      binding.worker = workerId
    }

    const logger = this.logger.child(binding, { level: 'trace' })

    const selectors = {
      stdout: { level: 'info', caller: 'STDOUT' },
      stderr: { level: 'error', caller: 'STDERR' }
    }

    worker.stdout.setEncoding('utf8')
    worker.stdout.on('data', raw => {
      if (raw.includes(kStderrMarker)) {
        this.#forwardThreadLog(logger, selectors.stderr, raw.replaceAll(kStderrMarker, ''), 'stderr')
      } else {
        this.#forwardThreadLog(logger, selectors.stdout, raw, 'stdout')
      }
    })

    // Whatever is outputted here, it come from a direct process.stderr.write in the thread.
    // There's nothing we can do about it in regard of out of order logs due to a Node bug.
    worker.stderr.setEncoding('utf8')
    worker.stderr.on('data', raw => {
      this.#forwardThreadLog(logger, selectors.stderr, raw, 'stderr')
    })
  }

  // label is the key in the logger object, either 'stdout' or 'stderr'
  #forwardThreadLog (logger, { level, caller }, data, label) {
    // When captureStdio is false, write directly to the logger destination
    if (!this.#config.logger.captureStdio) {
      this.#stdio[label].write(data)
      return
    }

    let plainMessages = ''
    for (const raw of data.split('\n')) {
      // First of all, try to parse the message as JSON
      let message
      let json
      // The message is a JSON object if it has at least 2 bytes
      if (raw.length >= 2) {
        try {
          message = JSON.parse(raw)
          json = true
        } catch {
          // No-op, we assume the message is raw
        }
      }

      let pinoLog

      if (message !== null && typeof message === 'object') {
        pinoLog =
          typeof message.level === 'number' &&
          // We want to accept both pino raw time (number) and time as formatted string
          (typeof message.time === 'number' || typeof message.time === 'string') &&
          typeof message.msg === 'string'
      }

      // Directly write to the Pino destination
      if (pinoLog) {
        if (!this.#loggerDestination) {
          continue
        }

        this.#loggerDestination.lastLevel = message.level
        this.#loggerDestination.lastTime = message.time
        this.#loggerDestination.lastMsg = message.msg
        this.#loggerDestination.lastObj = message
        this.#loggerDestination.lastLogger = logger
        this.#loggerDestination.write(raw + '\n')
        continue
      }

      if (json) {
        logger[level]({ caller, [label]: message })
        continue
      }

      // Not a Pino JSON nor a JSON object, accumulate the message
      if (!pinoLog && !json) {
        plainMessages += (plainMessages.length ? '\n' : '') + raw
      }
    }

    // Write whatever is left
    if (plainMessages.length > 0) {
      logger[level]({ caller }, plainMessages.replace(/\n$/, ''))
    }
  }

  // Due to Worker Threads implementation via MessagePort, it might happen that if two messages are printed almost
  // at the same time from a worker and the main thread, the latter always arrives first.
  // Let's wait few more ticks to ensure the right order.
  async #avoidOutOfOrderThreadLogs () {
    for (let i = 0; i < 2; i++) {
      await immediate()
    }
  }

  async #updateApplicationConfigWorkers (applicationId, workers) {
    this.logger.info(`Updating application "${applicationId}" config workers to ${workers}`)

    this.#applications.get(applicationId).workers.static = workers

    const workersIds = this.#workers.getKeys(applicationId)
    const promises = []

    for (const workerId of workersIds) {
      const worker = this.#workers.get(workerId)
      promises.push(sendViaITC(worker, 'updateWorkersCount', { applicationId, workers }))
    }

    const results = await Promise.allSettled(promises)
    for (const result of results) {
      if (result.status === 'rejected') {
        this.logger.error({ err: result.reason }, `Cannot update application "${applicationId}" workers`)
        throw result.reason
      }
    }

    this.#updateLoggingPrefixes()
  }

  async #updateApplicationConfigHealth (applicationId, health) {
    this.logger.info(`Updating application "${applicationId}" config health heap to ${JSON.stringify(health)}`)
    const { maxHeapTotal, maxYoungGeneration } = health

    const application = this.#applications.get(applicationId)
    if (maxHeapTotal) {
      application.health.maxHeapTotal = maxHeapTotal
    }
    if (maxYoungGeneration) {
      application.health.maxYoungGeneration = maxYoungGeneration
    }
  }

  async #validateUpdateApplicationResources (updates) {
    if (!Array.isArray(updates)) {
      throw new InvalidArgumentError('updates', 'must be an array')
    }
    if (updates.length === 0) {
      throw new InvalidArgumentError('updates', 'must have at least one element')
    }

    const validatedUpdates = []
    for (const update of updates) {
      const { application: applicationId } = update

      if (!applicationId) {
        throw new InvalidArgumentError('application', 'must be a string')
      }
      const applicationConfig = this.#applications.get(applicationId)
      if (!applicationConfig) {
        throw new ApplicationNotFoundError(applicationId, Array.from(this.getApplicationsIds()).join(', '))
      }

      const { workers: currentWorkers, health: currentHealth } = await this.getApplicationResourcesInfo(applicationId)

      let workers
      if (update.workers !== undefined) {
        if (typeof update.workers !== 'number') {
          throw new InvalidArgumentError('workers', 'must be a number')
        }
        if (update.workers <= 0) {
          throw new InvalidArgumentError('workers', 'must be greater than 0')
        }
        if (update.workers > MAX_WORKERS) {
          throw new InvalidArgumentError('workers', `must be less than ${MAX_WORKERS}`)
        }

        if (currentWorkers === update.workers) {
          this.logger.warn(
            { applicationId, workers: update.workers },
            'No change in the number of workers for application'
          )
        } else {
          workers = update.workers
        }
      }

      let maxHeapTotal, maxYoungGeneration
      if (update.health) {
        if (update.health.maxHeapTotal !== undefined) {
          if (typeof update.health.maxHeapTotal === 'string') {
            try {
              maxHeapTotal = parseMemorySize(update.health.maxHeapTotal)
            } catch {
              throw new InvalidArgumentError('maxHeapTotal', 'must be a valid memory size')
            }
          } else if (typeof update.health.maxHeapTotal === 'number') {
            maxHeapTotal = update.health.maxHeapTotal
            if (update.health.maxHeapTotal <= 0) {
              throw new InvalidArgumentError('maxHeapTotal', 'must be greater than 0')
            }
          } else {
            throw new InvalidArgumentError('maxHeapTotal', 'must be a number or a string representing a memory size')
          }

          if (currentHealth.maxHeapTotal === maxHeapTotal) {
            this.logger.warn({ applicationId, maxHeapTotal }, 'No change in the max heap total for application')
            maxHeapTotal = undefined
          }
        }

        if (update.health.maxYoungGeneration !== undefined) {
          if (typeof update.health.maxYoungGeneration === 'string') {
            try {
              maxYoungGeneration = parseMemorySize(update.health.maxYoungGeneration)
            } catch {
              throw new InvalidArgumentError('maxYoungGeneration', 'must be a valid memory size')
            }
          } else if (typeof update.health.maxYoungGeneration === 'number') {
            maxYoungGeneration = update.health.maxYoungGeneration
            if (update.health.maxYoungGeneration <= 0) {
              throw new InvalidArgumentError('maxYoungGeneration', 'must be greater than 0')
            }
          } else {
            throw new InvalidArgumentError(
              'maxYoungGeneration',
              'must be a number or a string representing a memory size'
            )
          }

          if (currentHealth.maxYoungGeneration && currentHealth.maxYoungGeneration === maxYoungGeneration) {
            this.logger.warn(
              { applicationId, maxYoungGeneration },
              'No change in the max young generation for application'
            )
            maxYoungGeneration = undefined
          }
        }
      }

      if (workers || maxHeapTotal || maxYoungGeneration) {
        let health
        if (maxHeapTotal || maxYoungGeneration) {
          health = {}
          if (maxHeapTotal) {
            health.maxHeapTotal = maxHeapTotal
          }
          if (maxYoungGeneration) {
            health.maxYoungGeneration = maxYoungGeneration
          }
        }
        validatedUpdates.push({
          applicationId,
          config: applicationConfig,
          workers,
          health,
          currentWorkers,
          currentHealth
        })
      }
    }

    return validatedUpdates
  }

  async #updateApplicationWorkersAndHealth (
    applicationId,
    config,
    applicationConfig,
    workers,
    health,
    currentWorkers,
    currentHealth
  ) {
    if (currentWorkers > workers) {
      // stop workers
      const reportWorkers = await this.#updateApplicationWorkers(
        applicationId,
        config,
        applicationConfig,
        workers,
        currentWorkers
      )
      // update heap for current workers
      const reportHealth = await this.#updateApplicationHealth(
        applicationId,
        config,
        applicationConfig,
        workers,
        currentHealth,
        health
      )

      return { workers: reportWorkers, health: reportHealth }
    } else {
      // update application heap
      await this.#updateApplicationConfigHealth(applicationId, health)
      // start new workers with new heap
      const reportWorkers = await this.#updateApplicationWorkers(
        applicationId,
        config,
        applicationConfig,
        workers,
        currentWorkers
      )
      // update heap for current workers
      const reportHealth = await this.#updateApplicationHealth(
        applicationId,
        config,
        applicationConfig,
        currentWorkers,
        currentHealth,
        health,
        false
      )

      return { workers: reportWorkers, health: reportHealth }
    }
  }

  async #updateApplicationHealth (
    applicationId,
    config,
    applicationConfig,
    currentWorkers,
    currentHealth,
    health,
    updateConfig = true
  ) {
    const report = {
      current: currentHealth,
      new: health,
      updated: []
    }
    try {
      if (updateConfig) {
        await this.#updateApplicationConfigHealth(applicationId, health)
      }

      for (let i = 0; i < currentWorkers; i++) {
        this.logger.info(
          { health: { current: currentHealth, new: health } },
          `Restarting application "${applicationId}" worker ${i} to update config health heap...`
        )

        const worker = await this.#getWorkerByIdOrNext(applicationId, i)
        if (health.maxHeapTotal) {
          worker[kConfig].health.maxHeapTotal = health.maxHeapTotal
        }
        if (health.maxYoungGeneration) {
          worker[kConfig].health.maxYoungGeneration = health.maxYoungGeneration
        }

        await this.#replaceWorker(config, applicationConfig, currentWorkers, applicationId, i, worker)
        report.updated.push(i)
        this.logger.info(
          { health: { current: currentHealth, new: health } },
          `Restarted application "${applicationId}" worker ${i}`
        )
      }
      report.success = true

      if (report.success) {
        this.emitAndNotify('application:resources:health:updated', { application: applicationId, health })
      }
    } catch (err) {
      if (report.updated.length < 1) {
        this.logger.error({ err }, 'Cannot update application health heap, no worker updated')
        await this.#updateApplicationConfigHealth(applicationId, currentHealth)
      } else {
        this.logger.error(
          { err },
          `Cannot update application health heap, updated workers: ${report.updated.length} out of ${currentWorkers}`
        )
      }
      report.success = false
    }
    return report
  }

  async #updateApplicationWorkers (applicationId, config, applicationConfig, workers, currentWorkers) {
    const report = { current: currentWorkers, new: workers }

    let startedWorkersCount = 0
    let stoppedWorkersCount = 0

    if (currentWorkers < workers) {
      report.started = []
      try {
        for (let i = currentWorkers; i < workers; i++) {
          await this.#setupWorker(config, applicationConfig, workers, applicationId, i)
          await this.#startWorker(config, applicationConfig, workers, applicationId, i, false, 0)
          report.started.push(i)
          startedWorkersCount++
        }
        report.success = true
      } catch (err) {
        if (startedWorkersCount < 1) {
          this.logger.error({ err }, 'Cannot start application workers, no worker started')
        } else {
          this.logger.error(
            { err },
            `Cannot start application workers, started workers: ${startedWorkersCount} out of ${workers}`
          )
        }
        report.success = false
      }
    } else {
      // keep the current workers count until all the application workers are all stopped
      report.stopped = []
      try {
        for (let i = currentWorkers - 1; i >= workers; i--) {
          const worker = await this.#getWorkerByIdOrNext(applicationId, i, false, false)
          await sendViaITC(worker, 'removeFromMesh')
          await this.#stopWorker(currentWorkers, applicationId, i, false, worker, [])
          report.stopped.push(i)
          stoppedWorkersCount++
        }
        report.success = true
      } catch (err) {
        if (stoppedWorkersCount < 1) {
          this.logger.error({ err }, 'Cannot stop application workers, no worker stopped')
        } else {
          this.logger.error(
            { err },
            `Cannot stop application workers, stopped workers: ${stoppedWorkersCount} out of ${workers}`
          )
        }
        report.success = false
      }
    }

    const newWorkersCount = currentWorkers + startedWorkersCount - stoppedWorkersCount
    if (newWorkersCount !== currentWorkers) {
      await this.#updateApplicationConfigWorkers(applicationId, newWorkersCount)
    }

    if (report.success) {
      this.emitAndNotify('application:resources:workers:updated', { application: applicationId, workers })
    }

    return report
  }

  #validatePprofCapturePreload () {
    const found = this.#config.preload?.some(p => p.includes('wattpm-pprof-capture'))

    if (!found) {
      throw new MissingPprofCapture()
    }
  }

  #setupPermissions (applicationConfig) {
    const argv = []
    const allows = new Set()
    const { read, write } = applicationConfig.permissions.fs

    if (read?.length) {
      for (const p of read) {
        allows.add(`--allow-fs-read=${isAbsolute(p) ? p : join(applicationConfig.path, p)}`)
      }
    }

    if (write?.length) {
      for (const p of write) {
        allows.add(`--allow-fs-write=${isAbsolute(p) ? p : join(applicationConfig.path, p)}`)
      }
    }

    if (allows.size === 0) {
      return argv
    }

    // We need to allow read access to the node_modules folder both at the runtime level and at the application level
    allows.add(`--allow-fs-read=${join(this.#root, 'node_modules', '*')}`)
    allows.add(`--allow-fs-read=${join(applicationConfig.path, 'node_modules', '*')}`)

    // Since we can't really predict how dependencies are installed (symlinks, pnpm store, and so forth), we also
    // add any node_modules folder found in the ancestors of the current file
    let lastPath = import.meta.dirname
    let currentPath = import.meta.dirname

    do {
      lastPath = currentPath
      const nodeModules = join(currentPath, 'node_modules')
      if (existsSync(nodeModules)) {
        allows.add(`--allow-fs-read=${join(nodeModules, '*')}`)
      }

      currentPath = dirname(currentPath)
    } while (lastPath !== currentPath)

    argv.push('--permission', ...allows)
    return argv
  }

  #processHealthSignals ({ workerId, signals }) {
    const worker = this.#workers.get(workerId)

    worker[kWorkerHealthSignals] ??= new HealthSignalsQueue()
    worker[kWorkerHealthSignals].add(signals)
  }

  #updateLoggingPrefixes () {
    if (!this.#loggerContext) {
      return
    }

    const ids = []
    for (const worker of this.#workers.values()) {
      ids.push(`${worker[kFullId]}`)
    }

    this.#loggerContext.updatePrefixes(ids)
  }

  #onMeshInterceptorError (error) {
    const worker = error.port

    this.logger.error(
      { err: ensureLoggableError(error.cause) },
      `The ${this.#workerExtendedLabel(worker[kApplicationId], worker[kWorkerId])} threw an error during mesh network setup. Replacing it ...`
    )

    this.emit('application:worker:init:failed', { application: worker[kApplicationId], worker: worker[kWorkerId] })
    worker.terminate()
  }
}
