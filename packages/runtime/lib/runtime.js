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
import os from 'node:os'
import { ITC } from '@platformatic/itc'
import fastify from 'fastify'
import { EventEmitter, once } from 'node:events'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { STATUS_CODES } from 'node:http'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { setImmediate as immediate, setTimeout as sleep } from 'node:timers/promises'
import { pathToFileURL } from 'node:url'
import { Worker } from 'node:worker_threads'
import SonicBoom from 'sonic-boom'
import { Agent, request, interceptors as undiciInterceptors } from 'undici'
import { createThreadInterceptor } from 'undici-thread-interceptor'
import {
  ApplicationAlreadyStartedError,
  ApplicationNotFoundError,
  ApplicationNotStartedError,
  ApplicationStartTimeoutError,
  InvalidArgumentError,
  MessagingError,
  MissingEntrypointError,
  MissingPprofCapture,
  RuntimeAbortedError,
  RuntimeExitedError,
  WorkerNotFoundError
} from './errors.js'
import { abstractLogger, createLogger } from './logger.js'
import { startManagementApi } from './management-api.js'
import { startPrometheusServer } from './prom-server.js'
import { startScheduler } from './scheduler.js'
import { createSharedStore } from './shared-http-cache.js'
import { version } from './version.js'
import { sendViaITC, waitEventFromITC } from './worker/itc.js'
import { RoundRobinMap } from './worker/round-robin-map.js'
import ScalingAlgorithm from './scaling-algorithm.js'
import {
  kApplicationId,
  kConfig,
  kFullId,
  kHealthCheckTimer,
  kId,
  kITC,
  kLastELU,
  kStderrMarker,
  kWorkerId,
  kWorkersBroadcast,
  kWorkerStatus
} from './worker/symbols.js'

const kWorkerFile = join(import.meta.dirname, 'worker/main.js')
const kInspectorOptions = Symbol('plt.runtime.worker.inspectorOptions')

const MAX_LISTENERS_COUNT = 100
const MAX_METRICS_QUEUE_LENGTH = 5 * 60 // 5 minutes in seconds
const COLLECT_METRICS_TIMEOUT = 1000

const MAX_CONCURRENCY = 5
const MAX_BOOTSTRAP_ATTEMPTS = 5
const IMMEDIATE_RESTART_MAX_THRESHOLD = 10
const MAX_WORKERS = 100

export class Runtime extends EventEmitter {
  logger
  error

  #loggerDestination
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

  #metrics
  #metricsTimeout

  #meshInterceptor
  #dispatcher

  #managementApi
  #prometheusServer
  #inspectorServer
  #metricsLabelName

  #applicationsConfigsPatches
  #workers
  #workersBroadcastChannel
  #workerITCHandlers
  #restartingWorkers

  #sharedHttpCache
  #scheduler

  constructor (config, context) {
    super()
    this.setMaxListeners(MAX_LISTENERS_COUNT)

    this.#config = config
    this.#root = config[kMetadata].root
    this.#env = config[kMetadata].env
    this.#context = context ?? {}
    this.#isProduction = this.#context.isProduction ?? this.#context.production ?? false
    this.#concurrency = this.#context.concurrency ?? MAX_CONCURRENCY
    this.#workers = new RoundRobinMap()
    this.#url = undefined
    this.#meshInterceptor = createThreadInterceptor({ domain: '.plt.local', timeout: this.#config.applicationTimeout })
    this.logger = abstractLogger // This is replaced by the real logger in init() and eventually removed in close()
    this.#status = undefined
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
      getSharedContext: this.getSharedContext.bind(this)
    }
    this.#sharedContext = {}
  }

  async init () {
    if (typeof this.#status !== 'undefined') {
      return
    }

    const config = this.#config

    if (config.managementApi) {
      this.#managementApi = await startManagementApi(this, this.#root)
    }

    if (config.metrics) {
      // Use the configured application label name for metrics (defaults to 'applicationId')
      this.#metricsLabelName = config.metrics.applicationLabel || 'applicationId'
      this.#prometheusServer = await startPrometheusServer(this, config.metrics)
    } else {
      // Default to applicationId if metrics are not configured
      this.#metricsLabelName = 'applicationId'
    }

    // Create the logger
    const [logger, destination] = await createLogger(config)
    this.logger = logger
    this.#loggerDestination = destination

    this.#createWorkersBroadcastChannel()

    const workersConfig = []
    for (const application of config.applications) {
      const count = application.workers ?? this.#config.workers ?? 1
      if (count > 1 && application.entrypoint && !features.node.reusePort) {
        this.logger.warn(
          `"${application.id}" is set as the entrypoint, but reusePort is not available in your OS; setting workers to 1 instead of ${count}`
        )
        workersConfig.push({ id: application.id, workers: 1 })
      } else {
        workersConfig.push({ id: application.id, workers: count })
      }
    }

    this.#workers.configure(workersConfig)

    if (this.#isProduction) {
      this.#env['PLT_DEV'] = 'false'
      this.#env['PLT_ENVIRONMENT'] = 'production'
    } else {
      this.#env['PLT_DEV'] = 'true'
      this.#env['PLT_ENVIRONMENT'] = 'development'
    }

    await this.#setupApplications()

    await this.#setDispatcher(config.undici)

    if (config.scheduler) {
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
      const startInvocations = []
      for (const application of this.getApplicationsIds()) {
        startInvocations.push([application, silent])
      }

      await executeInParallel(this.startApplication.bind(this), startInvocations, this.#concurrency)

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

    if (this.#managementApi && typeof this.#metrics === 'undefined') {
      this.startCollectingMetrics()
    }

    if (this.#config.verticalScaler?.enabled) {
      this.#setupVerticalScaler()
    }

    this.#showUrl()
    return this.#url
  }

  async stop (silent = false) {
    if (this.#scheduler) {
      await this.#scheduler.stop()
    }

    if (this.#status === 'starting') {
      await once(this, 'started')
    }

    this.#updateStatus('stopping')

    if (this.#inspectorServer) {
      await this.#inspectorServer.close()
    }

    // Stop the entrypoint first so that no new requests are accepted
    if (this.#entrypointId) {
      await this.stopApplication(this.#entrypointId, silent)
    }

    const stopInvocations = []

    // Construct the reverse dependency graph
    const dependents = {}

    try {
      const allApplications = await this.getApplications(true)
      for (const application of allApplications.applications) {
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

    for (const application of this.getApplicationsIds()) {
      // The entrypoint has been stopped above
      if (application === this.#entrypointId) {
        continue
      }

      stopInvocations.push([application, silent, Array.from(dependents[application] ?? [])])
    }

    await executeInParallel(this.stopApplication.bind(this), stopInvocations, this.#concurrency)

    await this.#meshInterceptor.close()
    this.#workersBroadcastChannel?.close()

    this.#updateStatus('stopped')
  }

  async restart (applications = []) {
    this.emitAndNotify('restarting')

    const restartInvocations = []
    for (const application of this.getApplicationsIds()) {
      if (applications.length === 0 || applications.includes(application)) {
        restartInvocations.push([application])
      }
    }

    await executeInParallel(this.restartApplication.bind(this), restartInvocations, this.#concurrency)

    this.emitAndNotify('restarted')

    return this.#url
  }

  async close (silent = false) {
    clearInterval(this.#metricsTimeout)

    await this.stop(silent)
    this.#updateStatus('closing')

    // The management API autocloses by itself via event in management-api.js.
    // This is needed to let management API stop endpoint to reply.

    if (this.#prometheusServer) {
      await this.#prometheusServer.close()
    }

    if (this.#sharedHttpCache?.close) {
      await this.#sharedHttpCache.close()
    }

    if (this.logger) {
      this.#loggerDestination?.end()

      this.logger = abstractLogger
      this.#loggerDestination = null
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

  async startApplication (id, silent = false) {
    // Since when an application is stopped the worker is deleted, we consider an application start if its first application
    // is no longer in the init phase
    const firstWorker = this.#workers.get(`${id}:0`)
    if (firstWorker && firstWorker[kWorkerStatus] !== 'boot' && firstWorker[kWorkerStatus] !== 'init') {
      throw new ApplicationAlreadyStartedError()
    }

    const config = this.#config
    const applicationConfig = config.applications.find(s => s.id === id)

    if (!applicationConfig) {
      throw new ApplicationNotFoundError(id, this.getApplicationsIds().join(', '))
    }

    const workersCount = await this.#workers.getCount(applicationConfig.id)

    this.emitAndNotify('application:starting', id)

    for (let i = 0; i < workersCount; i++) {
      await this.#startWorker(config, applicationConfig, workersCount, id, i, silent)
    }

    this.emitAndNotify('application:started', id)
  }

  async stopApplication (id, silent = false, dependents = []) {
    const config = this.#config
    const applicationConfig = config.applications.find(s => s.id === id)

    if (!applicationConfig) {
      throw new ApplicationNotFoundError(id, this.getApplicationsIds().join(', '))
    }

    const workersCount = await this.#workers.getCount(applicationConfig.id)

    this.emitAndNotify('application:stopping', id)

    if (typeof workersCount === 'number') {
      const stopInvocations = []
      for (let i = 0; i < workersCount; i++) {
        stopInvocations.push([workersCount, id, i, silent, undefined, dependents])
      }

      await executeInParallel(this.#stopWorker.bind(this), stopInvocations, this.#concurrency)
    }

    this.emitAndNotify('application:stopped', id)
  }

  async restartApplication (id) {
    const config = this.#config
    const applicationConfig = this.#config.applications.find(s => s.id === id)
    const workersCount = await this.#workers.getCount(id)

    this.emitAndNotify('application:restarting', id)

    for (let i = 0; i < workersCount; i++) {
      const label = `${id}:${i}`
      const worker = this.#workers.get(label)

      if (i > 0 && config.workersRestartDelay > 0) {
        await sleep(config.workersRestartDelay)
      }

      await this.#replaceWorker(config, applicationConfig, workersCount, id, i, worker, true)
    }

    this.emitAndNotify('application:restarted', id)
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

  async stopApplicationProfiling (id, ensureStarted = true) {
    const service = await this.#getApplicationById(id, ensureStarted)
    this.#validatePprofCapturePreload()

    return sendViaITC(service, 'stopProfiling')
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

  startCollectingMetrics () {
    this.#metrics = []
    this.#metricsTimeout = setInterval(async () => {
      if (this.#status !== 'started') {
        return
      }

      let metrics = null
      try {
        metrics = await this.getFormattedMetrics()
      } catch (error) {
        if (!(error instanceof RuntimeExitedError)) {
          this.logger.error({ err: ensureLoggableError(error) }, 'Error collecting metrics')
        }
        return
      }

      this.emitAndNotify('metrics', metrics)
      this.#metrics.push(metrics)
      if (this.#metrics.length > MAX_METRICS_QUEUE_LENGTH) {
        this.#metrics.shift()
      }
    }, COLLECT_METRICS_TIMEOUT).unref()
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

  async getUrl () {
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
    const status = {}

    for (const [application, { count }] of Object.entries(this.#workers.configuration)) {
      for (let i = 0; i < count; i++) {
        const label = `${application}:${i}`
        const worker = this.#workers.get(label)

        if (worker) {
          status[label] = await sendViaITC(worker, 'getCustomHealthCheck')
        }
      }
    }

    return status
  }

  async getCustomReadinessChecks () {
    const status = {}

    for (const [application, { count }] of Object.entries(this.#workers.configuration)) {
      for (let i = 0; i < count; i++) {
        const label = `${application}:${i}`
        const worker = this.#workers.get(label)

        if (worker) {
          status[label] = await sendViaITC(worker, 'getCustomReadinessCheck')
        }
      }
    }

    return status
  }

  async getMetrics (format = 'json') {
    let metrics = null

    for (const worker of this.#workers.values()) {
      try {
        // The application might be temporarily unavailable
        if (worker[kWorkerStatus] !== 'started') {
          continue
        }

        const applicationMetrics = await sendViaITC(worker, 'getMetrics', format)
        if (applicationMetrics) {
          if (metrics === null) {
            metrics = format === 'json' ? [] : ''
          }

          if (format === 'json') {
            metrics.push(...applicationMetrics)
          } else {
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

  getCachedMetrics () {
    return this.#metrics
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
    const workers = this.#workers.getCount(id)

    const worker = await this.#getWorkerById(id, 0, false, false)
    const health = worker[kConfig].health

    return { workers, health }
  }

  getApplicationsIds () {
    return this.#config.applications.map(application => application.id)
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

  async getWorkers () {
    const status = {}

    for (const [application, { count }] of Object.entries(this.#workers.configuration)) {
      for (let i = 0; i < count; i++) {
        const label = `${application}:${i}`
        const worker = this.#workers.get(label)

        status[label] = {
          application,
          worker: i,
          status: worker?.[kWorkerStatus] ?? 'exited',
          thread: worker?.threadId
        }
      }
    }

    return status
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

    const { entrypoint, localUrl } = application[kConfig]

    const status = await sendViaITC(application, 'getStatus')
    const { type, version, dependencies } = await sendViaITC(application, 'getApplicationInfo')

    const applicationDetails = {
      id,
      type,
      status,
      dependencies,
      version,
      localUrl,
      entrypoint
    }

    if (this.#isProduction) {
      applicationDetails.workers = this.#workers.getCount(id)
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
          methods: config.httpCache.methods ?? ['GET', 'HEAD']
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

  async #setupApplications () {
    const config = this.#config
    const setupInvocations = []

    // Parse all applications and verify we're not missing any path or resolved application
    for (const applicationConfig of config.applications) {
      // If there is no application path, check if the application was resolved
      if (!applicationConfig.path) {
        if (applicationConfig.url) {
          // Try to backfill the path for external applications
          applicationConfig.path = join(this.#root, config.resolvedApplicationsBasePath, applicationConfig.id)

          if (!existsSync(applicationConfig.path)) {
            const executable = globalThis.platformatic?.executable ?? 'platformatic'
            this.logger.error(
              `The path for application "%s" does not exist. Please run "${executable} resolve" and try again.`,
              applicationConfig.id
            )

            await this.closeAndThrow(new RuntimeAbortedError())
          }
        } else {
          this.logger.error(
            'The application "%s" has no path defined. Please check your configuration and try again.',
            applicationConfig.id
          )

          await this.closeAndThrow(new RuntimeAbortedError())
        }
      }

      setupInvocations.push([applicationConfig])
    }

    await executeInParallel(this.#setupApplication.bind(this), setupInvocations, this.#concurrency)
  }

  async #setupApplication (applicationConfig) {
    if (this.#status === 'stopping' || this.#status === 'closed') {
      return
    }

    const config = this.#config
    const workersCount = await this.#workers.getCount(applicationConfig.id)
    const id = applicationConfig.id
    const setupInvocations = []

    for (let i = 0; i < workersCount; i++) {
      setupInvocations.push([config, applicationConfig, workersCount, id, i])
    }

    await executeInParallel(this.#setupWorker.bind(this), setupInvocations, this.#concurrency)

    this.emitAndNotify('application:init', id)
  }

  async #setupWorker (config, applicationConfig, workersCount, applicationId, index, enabled = true) {
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

    const execArgv = []

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

    const workerEnv = structuredClone(this.#env)

    if (applicationConfig.nodeOptions?.trim().length > 0) {
      const originalNodeOptions = workerEnv['NODE_OPTIONS'] ?? ''

      workerEnv['NODE_OPTIONS'] = `${originalNodeOptions} ${applicationConfig.nodeOptions}`.trim()
    }

    const maxHeapTotal =
      typeof health.maxHeapTotal === 'string' ? parseMemorySize(health.maxHeapTotal) : health.maxHeapTotal
    const maxYoungGeneration =
      typeof health.maxYoungGeneration === 'string'
        ? parseMemorySize(health.maxYoungGeneration)
        : health.maxYoungGeneration

    const maxOldGenerationSizeMb = Math.floor(
      (maxYoungGeneration > 0 ? maxHeapTotal - maxYoungGeneration : maxHeapTotal) / (1024 * 1024)
    )
    const maxYoungGenerationSizeMb = maxYoungGeneration ? Math.floor(maxYoungGeneration / (1024 * 1024)) : undefined

    const worker = new Worker(kWorkerFile, {
      workerData: {
        config,
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
        maxYoungGenerationSizeMb
      },
      stdout: true,
      stderr: true
    })

    this.#handleWorkerStandardStreams(worker, applicationId, workersCount > 1 ? index : undefined)

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

    worker[kId] = workersCount > 1 ? workerId : applicationId
    worker[kFullId] = workerId
    worker[kApplicationId] = applicationId
    worker[kWorkerId] = workersCount > 1 ? index : undefined
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

      this.emit(event, ...payload)
      this.logger.trace({ event, payload }, 'Runtime event')
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

          this.logger.info(`The application "${applicationId}" has been successfully reloaded ...`)
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

      // Setup the interceptor
      this.#meshInterceptor.route(applicationId, worker)
    }

    // Wait for initialization
    await waitEventFromITC(worker, 'init')

    if (applicationConfig.entrypoint) {
      this.#entrypointId = applicationId
    }

    worker[kConfig] = { ...applicationConfig, health, workers: workersCount }
    worker[kWorkerStatus] = 'init'
    this.emitAndNotify('application:worker:init', eventPayload)

    return worker
  }

  async #getHealth (worker) {
    if (features.node.worker.getHeapStatistics) {
      const { used_heap_size: heapUsed, total_heap_size: heapTotal } = await worker.getHeapStatistics()
      const currentELU = worker.performance.eventLoopUtilization()
      const elu = worker[kLastELU] ? worker.performance.eventLoopUtilization(currentELU, worker[kLastELU]) : currentELU
      worker[kLastELU] = currentELU
      return { elu: elu.utilization, heapUsed, heapTotal }
    }

    const health = await worker[kITC].send('getHealth')
    return health
  }

  #setupHealthCheck (config, applicationConfig, workersCount, id, index, worker, errorLabel) {
    // Clear the timeout when exiting
    worker.on('exit', () => clearTimeout(worker[kHealthCheckTimer]))

    const { maxELU, maxHeapUsed, maxHeapTotal, maxUnhealthyChecks, interval } = worker[kConfig].health
    const maxHeapTotalNumber = typeof maxHeapTotal === 'string' ? parseMemorySize(maxHeapTotal) : maxHeapTotal

    let unhealthyChecks = 0

    worker[kHealthCheckTimer] = setTimeout(async () => {
      if (worker[kWorkerStatus] !== 'started') {
        return
      }

      let health, unhealthy, memoryUsage
      try {
        health = await this.#getHealth(worker)
        memoryUsage = health.heapUsed / maxHeapTotalNumber
        unhealthy = health.elu > maxELU || memoryUsage > maxHeapUsed
      } catch (err) {
        this.logger.error({ err }, `Failed to get health for ${errorLabel}.`)
        unhealthy = true
        memoryUsage = -1
        health = { elu: -1, heapUsed: -1, heapTotal: -1 }
      }

      this.emitAndNotify('application:worker:health', {
        id: worker[kId],
        application: id,
        worker: index,
        currentHealth: health,
        unhealthy,
        healthConfig: worker[kConfig].health
      })

      if (unhealthy) {
        if (health.elu > maxELU) {
          this.logger.error(
            `The ${errorLabel} has an ELU of ${(health.elu * 100).toFixed(2)} %, above the maximum allowed usage of ${(maxELU * 100).toFixed(2)} %.`
          )
        }

        if (memoryUsage > maxHeapUsed) {
          this.logger.error(
            `The ${errorLabel} is using ${(memoryUsage * 100).toFixed(2)} % of the memory, above the maximum allowed usage of ${(maxHeapUsed * 100).toFixed(2)} %.`
          )
        }

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
    }, interval)
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
      worker = await this.#getWorkerById(id, index, false, false)
    }

    const eventPayload = { application: id, worker: index, workersCount }

    // The application was stopped, recreate the thread
    if (!worker) {
      await this.#setupApplication(applicationConfig, index)
      worker = await this.#getWorkerById(id, index)
    }

    worker[kWorkerStatus] = 'starting'
    this.emitAndNotify('application:worker:starting', eventPayload)

    try {
      let workerUrl
      if (config.startTimeout > 0) {
        workerUrl = await executeWithTimeout(sendViaITC(worker, 'start'), config.startTimeout)

        if (workerUrl === kTimeout) {
          this.emitAndNotify('application:worker:startTimeout', eventPayload)
          this.logger.info(`The ${label} failed to start in ${config.startTimeout}ms. Forcefully killing the thread.`)
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

      worker[kWorkerStatus] = 'started'
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
      worker = await this.#getWorkerById(id, index, false, false)
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
    this.#meshInterceptor.unroute(worker[kApplicationId], worker, true)
    worker.removeAllListeners('exit')
    await worker.terminate()

    return this.#cleanupWorker(worker)
  }

  #workerExtendedLabel (applicationId, workerId, workersCount) {
    return workersCount > 1
      ? `worker ${workerId} of the application "${applicationId}"`
      : `application "${applicationId}"`
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
      this.#meshInterceptor.route(applicationId, newWorker)

      // Remove the old worker and then kill it
      await sendViaITC(worker, 'removeFromMesh')
    } catch (e) {
      newWorker?.terminate?.()
      throw e
    }

    if (!silent) {
      this.logger.debug(`Preparing to stop the old version of ${label} ...`)
    }
    await this.#stopWorker(workersCount, applicationId, index, false, worker, [])
  }

  async #getApplicationById (applicationId, ensureStarted = false, mustExist = true) {
    // If the applicationId includes the worker, properly split
    let workerId
    const matched = applicationId.match(/^(.+):(\d+)$/)

    if (matched) {
      applicationId = matched[1]
      workerId = matched[2]
    }

    return this.#getWorkerById(applicationId, workerId, ensureStarted, mustExist)
  }

  async #getWorkerById (applicationId, workerId, ensureStarted = false, mustExist = true) {
    let worker

    if (typeof workerId !== 'undefined') {
      worker = this.#workers.get(`${applicationId}:${workerId}`)
    } else {
      worker = this.#workers.next(applicationId)
    }

    const applicationsIds = this.getApplicationsIds()

    if (!worker) {
      if (!mustExist && applicationsIds.includes(applicationId)) {
        return null
      }

      if (applicationsIds.includes(applicationId)) {
        const availableWorkers = Array.from(this.#workers.keys())
          .filter(key => key.startsWith(applicationId + ':'))
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

  async #getWorkerMessagingChannel ({ application, worker }, context) {
    const target = await this.#getWorkerById(application, worker, true, true)

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

      const pinoLog =
        typeof message?.level === 'number' && typeof message?.time === 'number' && typeof message?.msg === 'string'

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

    this.#config.applications.find(s => s.id === applicationId).workers = workers
    const application = await this.#getApplicationById(applicationId)
    this.#workers.setCount(applicationId, workers)
    application[kConfig].workers = workers

    const promises = []
    for (const [workerId, worker] of this.#workers.entries()) {
      if (workerId.startsWith(`${applicationId}:`)) {
        promises.push(sendViaITC(worker, 'updateWorkersCount', { applicationId, workers }))
      }
    }

    const results = await Promise.allSettled(promises)
    for (const result of results) {
      if (result.status === 'rejected') {
        this.logger.error({ err: result.reason }, `Cannot update application "${applicationId}" workers`)
        throw result.reason
      }
    }
  }

  async #updateApplicationConfigHealth (applicationId, health) {
    this.logger.info(`Updating application "${applicationId}" config health heap to ${JSON.stringify(health)}`)
    const { maxHeapTotal, maxYoungGeneration } = health

    const application = this.#config.applications.find(s => s.id === applicationId)
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

    const config = this.#config
    const validatedUpdates = []
    for (const update of updates) {
      const { application: applicationId } = update

      if (!applicationId) {
        throw new InvalidArgumentError('application', 'must be a string')
      }
      const applicationConfig = config.applications.find(s => s.id === applicationId)
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

        const worker = await this.#getWorkerById(applicationId, i)
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
    const report = {
      current: currentWorkers,
      new: workers
    }
    if (currentWorkers < workers) {
      report.started = []
      try {
        await this.#updateApplicationConfigWorkers(applicationId, workers)
        for (let i = currentWorkers; i < workers; i++) {
          await this.#setupWorker(config, applicationConfig, workers, applicationId, i)
          await this.#startWorker(config, applicationConfig, workers, applicationId, i, false, 0)
          report.started.push(i)
        }
        report.success = true
      } catch (err) {
        if (report.started.length < 1) {
          this.logger.error({ err }, 'Cannot start application workers, no worker started')
          await this.#updateApplicationConfigWorkers(applicationId, currentWorkers)
        } else {
          this.logger.error(
            { err },
            `Cannot start application workers, started workers: ${report.started.length} out of ${workers}`
          )
          await this.#updateApplicationConfigWorkers(applicationId, currentWorkers + report.started.length)
        }
        report.success = false
      }
    } else {
      // keep the current workers count until all the application workers are all stopped
      report.stopped = []
      try {
        for (let i = currentWorkers - 1; i >= workers; i--) {
          const worker = await this.#getWorkerById(applicationId, i, false, false)
          await sendViaITC(worker, 'removeFromMesh')
          await this.#stopWorker(currentWorkers, applicationId, i, false, worker, [])
          report.stopped.push(i)
        }
        await this.#updateApplicationConfigWorkers(applicationId, workers)
        report.success = true
      } catch (err) {
        if (report.stopped.length < 1) {
          this.logger.error({ err }, 'Cannot stop application workers, no worker stopped')
        } else {
          this.logger.error(
            { err },
            `Cannot stop application workers, stopped workers: ${report.stopped.length} out of ${workers}`
          )
          await this.#updateApplicationConfigWorkers(applicationId, currentWorkers - report.stopped)
        }
        report.success = false
      }
    }
    return report
  }

  #validatePprofCapturePreload () {
    const found = this.#config.preload?.some(p => p.includes('wattpm-pprof-capture'))

    if (!found) {
      throw new MissingPprofCapture()
    }
  }

  #setupVerticalScaler () {
    const isWorkersFixed = this.#config.workers !== undefined
    if (isWorkersFixed) return

    const scalerConfig = this.#config.verticalScaler

    const maxTotalWorkers = scalerConfig.maxTotalWorkers ?? os.cpus().length
    const maxWorkers = scalerConfig.maxWorkers ?? maxTotalWorkers
    const minWorkers = scalerConfig.minWorkers ?? 1
    const cooldown = scalerConfig.cooldownSec ?? 60
    const scaleUpELU = scalerConfig.scaleUpELU ?? 0.8
    const scaleDownELU = scalerConfig.scaleDownELU ?? 0.2
    const minELUDiff = scalerConfig.minELUDiff ?? 0.2
    const scaleIntervalSec = scalerConfig.scaleIntervalSec ?? 60
    const timeWindowSec = scalerConfig.timeWindowSec ?? 60
    const applicationsConfigs = scalerConfig.applications ?? {}

    for (const application of this.#config.applications) {
      if (application.entrypoint && !features.node.reusePort) {
        applicationsConfigs[application.id] = {
          minWorkers: 1,
          maxWorkers: 1
        }
        continue
      }
      if (application.workers !== undefined) {
        applicationsConfigs[application.id] = {
          minWorkers: application.workers,
          maxWorkers: application.workers
        }
        continue
      }

      applicationsConfigs[application.id] ??= {}
      applicationsConfigs[application.id].minWorkers ??= minWorkers
      applicationsConfigs[application.id].maxWorkers ??= maxWorkers
    }

    for (const applicationId in applicationsConfigs) {
      const application = this.#config.applications.find(
        app => app.id === applicationId
      )
      if (!application) {
        this.logger.warn(
          `Vertical scaler configuration has a configuration for non-existing application "${applicationId}"`
        )
      }
    }

    const scalingAlgorithm = new ScalingAlgorithm({
      maxTotalWorkers,
      scaleUpELU,
      scaleDownELU,
      minELUDiff,
      timeWindowSec,
      applications: applicationsConfigs
    })

    this.on('application:worker:health', async (healthInfo) => {
      if (!healthInfo) {
        this.logger.error('No health info received')
        return
      }

      scalingAlgorithm.addWorkerHealthInfo(healthInfo)

      if (healthInfo.currentHealth.elu > scaleUpELU) {
        await checkForScaling()
      }
    })

    let isScaling = false
    let lastScaling = 0

    const checkForScaling = async () => {
      const isInCooldown = Date.now() < lastScaling + cooldown * 1000
      if (isScaling || isInCooldown) return
      isScaling = true

      try {
        const workersInfo = await this.getWorkers()

        const appsWorkersInfo = {}
        for (const worker of Object.values(workersInfo)) {
          if (worker.status === 'exited') continue

          const applicationId = worker.application
          appsWorkersInfo[applicationId] ??= 0
          appsWorkersInfo[applicationId]++
        }

        const recommendations = scalingAlgorithm.getRecommendations(appsWorkersInfo)
        if (recommendations.length > 0) {
          await applyRecommendations(recommendations)
        }
      } catch (err) {
        this.logger.error({ err }, 'Failed to scale applications')
      } finally {
        isScaling = false
        lastScaling = Date.now()
      }
    }

    const applyRecommendations = async (recommendations) => {
      const resourcesUpdates = []
      for (const recommendation of recommendations) {
        const { applicationId, workersCount, direction } = recommendation
        this.logger.info(`Scaling ${direction} the "${applicationId}" app to ${workersCount} workers`)

        resourcesUpdates.push({
          application: applicationId,
          workers: workersCount
        })
      }
      await this.updateApplicationsResources(resourcesUpdates)
    }

    // Interval for periodic scaling checks
    setInterval(checkForScaling, scaleIntervalSec * 1000).unref()
  }
}
