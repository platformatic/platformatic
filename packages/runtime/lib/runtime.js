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
import { getExecutable } from '@platformatic/globals'
import { ITC } from '@platformatic/itc'
import {
  collectProcessMetrics,
  client as metricsClient,
  openTelemetryITCMessage
} from '@platformatic/metrics'
import fastify from 'fastify'
import { EventEmitter, once } from 'node:events'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { STATUS_CODES } from 'node:http'
import { createRequire } from 'node:module'
import { availableParallelism } from 'node:os'
import { basename, dirname, isAbsolute, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { Readable } from 'node:stream'
import { finished } from 'node:stream/promises'
import { setImmediate as immediate, setTimeout as sleep } from 'node:timers/promises'
import { pathToFileURL } from 'node:url'
import { Worker } from 'node:worker_threads'
import SonicBoom from 'sonic-boom'
import { Agent, request, interceptors as undiciInterceptors } from 'undici'
import { createCoordinator, createInterceptor } from 'undici-thread-interceptor'
import { pprofCapturePreloadPath } from './config.js'
import {
  AddressInUseError,
  WorkerAddressInUseError,
  ApplicationAlreadyStartedError,
  ApplicationNotFoundError,
  ApplicationNotStartedError,
  ApplicationStartTimeoutError,
  DuplicateExtensionHealthCheckError,
  DuplicateITCHandlerNameError,
  ExtensionHealthRoutesUnavailableError,
  FailedToLoadExtensionError,
  FailedToStartExtensionError,
  FailedToStopExtensionError,
  InvalidArgumentError,
  InvalidExtensionError,
  LastProfileTimeoutError,
  MessagingError,
  MetricFamilyCollisionError,
  MissingPprofCapture,
  MixedServingStateError,
  ReservedITCHandlerNameError,
  RuntimeAbortedError,
  RuntimeExtensionBuildAlreadyCalledError,
  WorkerNotFoundError
} from './errors.js'
import { abstractLogger, createLogger } from './logger.js'
import { startManagementApi } from './management-api.js'
import { createManagementHandlers } from './management-handlers.js'
import { OpenTelemetryMetricsForwarder } from './opentelemetry-metrics.js'
import { createChannelCreationHook, createTargetPermissionHook } from './policies.js'
import { startHealthProbesServer, startPrometheusServer } from './prom-server.js'
import { startScheduler } from './scheduler.js'
import { createSharedStore } from './shared-http-cache.js'
import { topologicalLevels, topologicalSort } from './utils.js'
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
  kIsSubprocessHost,
  kITC,
  kLastHealthCheckELU,
  kStderrMarker,
  kWorkerHealthSignals,
  kWorkerId,
  kWorkerPortOffset,
  kWorkerServerOptions,
  kWorkerUrl,
  kWorkersBroadcast,
  kWorkerStartTime,
  kWorkerStatus
} from './worker/symbols.js'

const kWorkerFile = join(import.meta.dirname, 'worker/main.js')
const kInspectorOptions = Symbol('plt.runtime.worker.inspectorOptions')
const kHeapCheckCounter = Symbol('plt.runtime.worker.heapCheckCounter')
const kLastHeapStats = Symbol('plt.runtime.worker.lastHeapStats')
const kProfilingELUGates = Symbol('plt.runtime.worker.profilingELUGates')
const kWorkerScheduledTasks = Symbol('plt.runtime.worker.scheduledTasks')
const kHealthITCTimeoutMs = 5000
const kProfilingELUHysteresis = 0.1
const kLastProfileTimeoutMs = 10000

// getApplicationLastProfile falls back to the preserved overload profile
// whenever the worker cannot currently provide one: it is gone, profiling was
// not (re)started, no window has completed yet (e.g. profiling was just
// restarted on a replacement worker) or the profiler is paused with no recent
// window. The returned timestamp lets consumers judge freshness. Any other
// error is rethrown.
const kLastProfileFallbackCodes = new Set([
  'PLT_RUNTIME_APPLICATION_NOT_FOUND',
  'PLT_RUNTIME_WORKER_NOT_FOUND',
  'PLT_RUNTIME_APPLICATION_NOT_STARTED',
  'PLT_PPROF_PROFILING_NOT_STARTED',
  'PLT_PPROF_NO_PROFILE_AVAILABLE',
  'PLT_PPROF_NOT_ENOUGH_ELU'
])
const kApplicationRestartsMetricName = 'platformatic_application_restarts_total'
const kApplicationRestartsMetricHelp = 'Total number of restarts triggered by the runtime for an application.'

const MAX_LISTENERS_COUNT = 100

function hasWorkerIndex (applicationId) {
  return /^.+:\d+$/.test(applicationId)
}

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

function formatMetricValue (value) {
  if (Number.isNaN(value)) {
    return 'NaN'
  } else if (!Number.isFinite(value)) {
    return value < 0 ? '-Inf' : '+Inf'
  }

  return `${value}`
}

// Resolves the setup function of a runtime extension out of its module namespace.
//
// The canonical form is a default export, but transpilers and bundlers emit
// faux ESM modules, in which the real exports are properties of `module.exports`
// and therefore only reachable via an additional `default` hop. The setup
// function can also be exported as a named `setup` export, at both levels.
function resolveExtensionSetup (imported) {
  const candidates = [imported?.default, imported?.setup, imported?.default?.default, imported?.default?.setup]

  for (const candidate of candidates) {
    if (typeof candidate === 'function') {
      return candidate
    }
  }

  return null
}

// Always run operations in parallel to avoid deadlocks when services have dependencies
const DEFAULT_CONCURRENCY = availableParallelism() * 2
const MAX_BOOTSTRAP_ATTEMPTS = 5
const IMMEDIATE_RESTART_MAX_THRESHOLD = 10
const MAX_WORKERS = 100
const DEFAULT_RESTART_ON_ERROR_DELAY = 5000

/*
  Both public payloads are built from a snapshot and frozen through. What a consumer could observe
  in v3 was scalars and a file path, so handing out interior state was harmless in practice; v4
  nests resolvedConfig -- an entire capability payload -- inside every entry, and the getters read
  straight off live state. A consumer mutating what it received would be editing the configuration
  that later restarts and scale-up workers read, silently, and would make worker generations
  disagree about what they are running. setApplicationConfigPatch exists precisely so that changing
  a running application's configuration is explicit, patch-shaped and visible.

  Only plain objects and arrays are copied. Anything carrying its own prototype -- a class
  instance, a stream, a buffer -- is handed back as it is, because a copy of it would not be the
  thing; the hazard this closes is a consumer editing configuration, not one editing a socket.
*/
function frozenSnapshot (value, seen = new Map()) {
  if (value === null || typeof value !== 'object') {
    return value
  }

  if (seen.has(value)) {
    return seen.get(value)
  }

  if (Array.isArray(value)) {
    const copy = []
    seen.set(value, copy)

    for (const entry of value) {
      copy.push(frozenSnapshot(entry, seen))
    }

    return Object.freeze(copy)
  }

  const prototype = Object.getPrototypeOf(value)

  if (prototype !== Object.prototype && prototype !== null) {
    return value
  }

  const copy = {}
  seen.set(value, copy)

  for (const [key, entry] of Object.entries(value)) {
    copy[key] = frozenSnapshot(entry, seen)
  }

  return Object.freeze(copy)
}

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
  #pinoLevelKey
  #pinoTimeKey
  #pinoMessageKey
  #pinoCustomizedKeys
  #context
  #sharedContext
  #isProduction
  #concurrency

  #healthMetricsTimer
  #healthMetricsCollectionActive

  #meshInterceptor
  #meshCoordinator
  #meshId
  #dispatcher

  #managementApi
  #prometheusServer
  #healthProbesServer
  #opentelemetryMetricsForwarder
  #inspectorServer
  #metricsLabelName

  #applicationsConfigsPatches
  #applications
  #applicationRestartCounts
  #workers
  #workersBroadcastChannel
  #workerITCHandlers
  #reservedITCHandlerNames
  #extensions
  #extensionsWantHealthMetrics
  #extensionReadinessChecks
  #extensionLivenessChecks
  #extensionHealthRoutes
  #lastOverloadProfiles
  #servingStates
  #restartingApplications
  #restartingWorkers
  #workerPortOffsets
  #dynamicWorkersScaler
  #nextWorkerIndex

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
    this.#pinoLevelKey = config.logger.pino?.level ?? 'level'
    this.#pinoTimeKey = config.logger.pino?.time ?? 'time'
    this.#pinoMessageKey = config.logger.pino?.message ?? 'msg'
    this.#pinoCustomizedKeys =
      this.#pinoLevelKey !== 'level' || this.#pinoTimeKey !== 'time' || this.#pinoMessageKey !== 'msg'
    this.#context = context ?? {}
    this.#isProduction = this.#context.isProduction ?? this.#context.production ?? false
    this.#concurrency = Math.max(1, config.startupConcurrency ?? this.#context.concurrency ?? DEFAULT_CONCURRENCY)
    this.#applications = new Map()
    this.#applicationRestartCounts = new Map()
    this.#workers = new RoundRobinMap()
    this.#channelCreationHook = createChannelCreationHook(this.#config)
    this.#meshId = `runtime-${randomUUID()}`
    this.logger = abstractLogger // This is replaced by the real logger in init() and eventually removed in close()
    this.#status = undefined
    this.#restartingApplications = new Set()
    this.#restartingWorkers = new Map()
    this.#workerPortOffsets = new Map() // fullWorkerId => portOffset
    this.#nextWorkerIndex = new Map()
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
    this.#reservedITCHandlerNames = new Set(Object.keys(this.#workerITCHandlers))
    // Registered per-worker in #setupWorker, reserved so extensions cannot clobber it
    this.#reservedITCHandlerNames.add('profiling:started')
    this.#extensions = []
    this.#extensionsWantHealthMetrics = false
    this.#extensionReadinessChecks = new Map()
    this.#extensionLivenessChecks = new Map()
    this.#extensionHealthRoutes = []
    this.#lastOverloadProfiles = new Map()
    this.#servingStates = new Map()
    this.#sharedContext = {}

    /*
      v3 injected `PLT_DEV` and `PLT_ENVIRONMENT` here. v4 removes them: an application branches on
      its own variables, or the decision moves into the configuration, where the context carries
      `production` and `mode` with types. `NODE_ENV` is the one the runtime still defaults, at the
      bottom of the env ladder, so anything the project sets outranks it.

      They were worse than redundant by the end -- the v4 worker environment is the one the loader
      resolved per application, and these were written onto the runtime's own copy, so under
      `wattpm start` an application still read `PLT_ENVIRONMENT=development`.
    */
  }

  async init () {
    if (typeof this.#status !== 'undefined') {
      return
    }

    const config = this.#config

    if (config.metrics) {
      // Use the configured application label name for metrics (defaults to 'applicationId')
      this.#metricsLabelName = config.metrics.applicationLabel || 'applicationId'
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

    // Create the logger before the management API, the extensions and the health/metrics servers
    // so that all of them can use it.
    const [logger, destination, context] = await createLogger(config)
    this.logger = logger
    this.#loggerDestination = destination
    this.#loggerContext = context

    if (config.managementApi) {
      this.#managementApi = await startManagementApi(this, config.managementApi)
    }

    await this.#startOpenTelemetryMetricsForwarder(config.metrics?.opentelemetry)

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

    // Load extensions before creating any worker so that custom ITC handlers
    // registered by the extensions are available to all workers. Also load them
    // before starting the health/metrics servers so extensions can register
    // readiness/liveness checks and probe routes before Fastify starts listening.
    await this.#loadExtensions()

    if (config.metrics || (typeof config.healthProbes === 'object' && config.healthProbes !== null)) {
      this.#prometheusServer = await startPrometheusServer(this, config.metrics ?? false, config.healthProbes)
    }

    this.#healthProbesServer = await startHealthProbesServer(this, config.metrics, config.healthProbes)
    this.#assertExtensionHealthRoutesApplied()

    this.#meshCoordinator = createCoordinator({ meshId: this.#meshId })
    this.#meshInterceptor = createInterceptor({
      meshId: this.#meshId,
      domain: '.plt.local',
      connectTimeout: this.#config.applicationTimeout,
      bootstrapTimeout: this.#config.applicationTimeout,
      allowTarget: createTargetPermissionHook(this.#config)
    })
    await this.#meshInterceptor.ready

    await this.addApplications(this.#config.applications)
    await this.#setDispatcher(config.undici)

    if (!this.#context.build) {
      this.#scheduler = startScheduler(config.scheduler ?? [], this.#dispatcher, logger)
    }

    this.#updateStatus('init')
  }

  async start (silent = false) {
    if (typeof this.#status === 'undefined') {
      await this.init()
    }

    this.#updateStatus('starting')
    this.#createWorkersBroadcastChannel()

    try {
      // Snapshot originally configured application IDs before extension start hooks.
      // Dynamic applications started by an extension are excluded from the normal startup pass.
      const configuredApplications = this.getApplicationsIds()

      await this.#startExtensions()

      const applicationsToStart = configuredApplications.filter(id => !this.#isApplicationStarted(id))
      await this.startApplications(applicationsToStart, silent)

      if (this.getApplicationsIds().length === 0) {
        this.#updateStatus('started')
        await this.close(silent)
        return {}
      }

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
    this.#showUrls()
    return this.getUrls()
  }

  async stop (silent = false) {
    if (this.#status === 'starting') {
      await once(this, 'started')
    }

    if (this.#status === 'stopping') {
      await once(this, 'stopped')
      return
    }

    if (this.#status === 'stopped' || this.#status === 'closing' || this.#status === 'closed') {
      return
    }

    this.#updateStatus('stopping')

    if (this.#scheduler) {
      await this.#scheduler.stop()
    }

    if (this.#inspectorServer) {
      await this.#inspectorServer.close()
    }

    await this.#dynamicWorkersScaler?.stop()

    // Await extension stop hooks before stopping remaining applications so that
    // control-plane extensions can settle work and hand off state first.
    await this.#stopExtensions()

    await this.stopApplications(this.getApplicationsIds(), silent)

    await this.#meshInterceptor?.close()
    this.#meshCoordinator?.destroy()
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
  }

  async close (silent = false) {
    if (this.#status === 'closing') {
      await once(this, 'closed')
      return
    }

    if (this.#status === 'closed') {
      return
    }

    clearTimeout(this.#healthMetricsTimer)
    this.#healthMetricsCollectionActive = false
    this.#lastOverloadProfiles.clear()
    this.#servingStates.clear()

    await this.stop(silent)
    this.#updateStatus('closing')

    await this.#closeExtensions()

    // The management API autocloses by itself via event in management-api.js.
    // This is needed to let management API stop endpoint to reply.

    if (this.#prometheusServer) {
      await this.#prometheusServer.close()
    }

    if (this.#healthProbesServer) {
      await this.#healthProbesServer.close()
    }

    if (this.#opentelemetryMetricsForwarder) {
      await this.#opentelemetryMetricsForwarder.close()
      this.#opentelemetryMetricsForwarder = null
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
      const loggerDestination = this.#loggerDestination
      const loggerCloseables = this.#loggerContext?.closeables ?? []

      this.logger = abstractLogger
      this.#loggerDestination = null
      this.#loggerContext = null

      if (loggerDestination) {
        loggerDestination.end()
        await finished(loggerDestination).catch(() => {})
      }

      for (const closeable of loggerCloseables) {
        closeable.end?.()
        await finished(closeable).catch(() => {})
      }
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
      this.#applications.set(application.id, application)
      this.#applicationRestartCounts.set(application.id, this.#applicationRestartCounts.get(application.id) ?? 0)
      setupInvocations.push([application])
      toStart.push(application.id)
    }

    await executeInParallel(this.#setupApplication.bind(this), setupInvocations, this.#concurrency)

    for (const application of applications) {
      this.logger.debug(`Added application "${application.id}".`)
      this.emitAndNotify('application:added', application)
    }

    if (start) {
      await this.startApplications(toStart)
    }

    const created = []
    for (const { id } of applications) {
      created.push(await this.#buildApplicationDetails(id))
    }

    this.#updateLoggingPrefixes()
    return created
  }

  async removeApplications (applications, silent = false) {
    const removed = []
    for (const application of applications) {
      if (!this.#applications.has(application)) {
        throw new ApplicationNotFoundError(application, this.getApplicationsIds().join(', '))
      }

      // Use allowUnloaded so that applications without a live worker
      // (stopped or crashed with restartOnError: 0) can still be removed.
      const details = await this.#buildApplicationDetails(application, true)
      details.status = 'removed'

      // The snapshot is taken while the application is still up, but what it reports is an
      // application about to be gone: it is not making a claim about how it would serve.
      delete details.servingState

      removed.push(details)
    }

    await this.stopApplications(applications, silent, true)

    for (const application of applications) {
      this.#dynamicWorkersScaler?.remove(application)
      await this.#scheduler?.removeApplicationJobs(application)
      this.#applications.delete(application)
      this.#applicationRestartCounts.delete(application)
    }

    for (const application of applications) {
      this.logger.warn(`Removed application "${application}".`)
      this.emitAndNotify('application:removed', application)
    }

    this.#updateLoggingPrefixes()
    return removed
  }

  async startApplications (applications, silent = false) {
    // For each application, get its dependencies from any available worker.
    const dependencies = new Map()
    for (const applicationId of applications) {
      const worker = await this.#getWorkerByIdOrNext(applicationId)

      dependencies.set(applicationId, await sendViaITC(worker, 'getDependencies'))
    }

    // Now, topological sort the applications based on their dependencies.
    // If circular dependencies are detected, an error with proper error code is thrown.
    applications = topologicalSort(applications, dependencies)

    // Group into dependency levels so that each level's dependencies are all
    // in previous levels. Levels are started sequentially, but applications
    // within the same level start in parallel.
    const levels = topologicalLevels(applications, dependencies)

    for (const level of levels) {
      const applicationsWithPort = await Promise.all(
        level.map(async applicationId => {
          const worker = await this.#getWorkerByIdOrNext(applicationId)
          const applicationConfig = await sendViaITC(worker, 'getApplicationConfig')
          const port = Number(applicationConfig?.server?.port)
          return { applicationId, hasPort: Number.isInteger(port) && port > 0 }
        })
      )

      for (const hasPort of [true, false]) {
        const startInvocations = applicationsWithPort
          .filter(application => application.hasPort === hasPort)
          .map(({ applicationId }) => [applicationId, silent])

        if (startInvocations.length > 0) {
          await executeInParallel(this.startApplication.bind(this), startInvocations, this.#concurrency)
        }
      }
    }
  }

  async stopApplications (applicationsToStop, silent = false, skipDependencies = false) {
    const stopInvocations = []

    // Construct the reverse dependency graph
    const dependents = {}

    if (!skipDependencies) {
      try {
        const details = await executeWithTimeout(
          this.getApplications(true),
          this.#config.gracefulShutdown.application
        )
        if (details !== kTimeout) {
          for (const application of details.applications) {
            for (const dependency of application.dependencies ?? []) {
              let applicationDependents = dependents[dependency]
              if (!applicationDependents) {
                applicationDependents = new Set()
                dependents[dependency] = applicationDependents
              }

              applicationDependents.add(application.id)
            }
          }
        }
      } catch (e) {
        // Noop - This only happens if stop is invoked after a failed start, in which case we don't care about deps
      }
    }

    for (const application of applicationsToStop) {
      stopInvocations.push([application, silent, Array.from(dependents[application] ?? [])])
    }

    return executeInParallel(this.stopApplication.bind(this), stopInvocations, this.#concurrency)
  }

  async restartApplications (applicationsToRestart) {
    const restartInvocations = applicationsToRestart.map(application => [application, true])
    const restarts = await executeInParallel(
      this.restartApplication.bind(this),
      restartInvocations,
      this.#concurrency,
      false
    )
    const failed = restarts.filter(result => result instanceof Error)
    const succeeded = restarts.filter(result => result && !(result instanceof Error))

    if (failed.length > 0) {
      await Promise.allSettled(succeeded.map(restart => restart.discard()))
      throw failed[0]
    }

    const results = await executeInParallel(
      retirement => retirement.retire(),
      succeeded.flatMap(({ retirements }) => retirements.map(retirement => [retirement])),
      this.#concurrency,
      false
    )

    const error = results.find(result => result instanceof Error)
    if (error) {
      for (const restart of succeeded) {
        restart.release()
      }
      throw error
    }

    for (const restart of succeeded) {
      restart.complete()
    }
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

    await this.#registerApplicationSchedulerJobs(id)
    await this.#collectServingState(id)

    this.emitAndNotify('application:started', id)
    await this.#dynamicWorkersScaler?.applyPendingUpdate(id)
  }

  async stopApplication (id, silent = false, dependents = []) {
    if (!this.#applications.has(id)) {
      throw new ApplicationNotFoundError(id, this.getApplicationsIds().join(', '))
    }

    const workersIds = this.#workers.getKeys(id)
    const workersCount = workersIds.length

    this.emitAndNotify('application:stopping', id)
    await this.#scheduler?.stopApplicationJobs(id)

    if (typeof workersCount === 'number') {
      const stopInvocations = []
      for (const workerId of workersIds) {
        const i = parseInt(workerId.split(':')[1])
        stopInvocations.push([workersCount, id, i, silent, undefined, dependents])
      }

      await executeInParallel(this.#stopWorker.bind(this), stopInvocations, this.#concurrency)
    }

    // Absent rather than 'inactive': a stopped application is not making a claim about how it
    // would serve, and conflating "not started" with "started and serving nothing" is the exact
    // distinction this field exists to draw.
    this.#servingStates.delete(id)

    this.emitAndNotify('application:stopped', id)
  }

  async restartApplication (id, deferOldWorkerRetirement = false) {
    const applicationConfig = this.#applications.get(id)

    if (!applicationConfig) {
      throw new ApplicationNotFoundError(id, this.getApplicationsIds().join(', '))
    }

    if (this.#restartingApplications.has(id)) {
      return
    }

    // Wait for the runtime to be fully started before attempting a restart.
    // Restarting an application while the runtime is still starting causes
    // races between the start and stop ITC commands in the worker thread.
    if (this.#status === 'starting') {
      await once(this, 'started')
    }

    this.#restartingApplications.add(id)
    const retirements = []
    let deferred = false

    try {
      const config = this.#config
      const workersIds = await this.#workers.getKeys(id)
      const workersCount = workersIds.length

      this.emitAndNotify('application:restarting', id)

      for (let i = 0; i < workersCount; i++) {
        const workerId = workersIds[i]
        const worker = this.#workers.get(workerId)
        const workerIndex = parseInt(workerId.split(':')[1], 10)

        if (i > 0 && config.workersRestartDelay > 0) {
          await sleep(config.workersRestartDelay)
        }

        const retirement = await this.#replaceWorker(
          config,
          applicationConfig,
          workersCount,
          id,
          workerIndex,
          worker,
          true,
          deferOldWorkerRetirement
        )
        if (retirement) {
          retirements.push(retirement)
        }
      }

      if (deferOldWorkerRetirement) {
        deferred = true
        return {
          retirements,
          release: () => this.#restartingApplications.delete(id),
          discard: async () => {
            await Promise.allSettled(retirements.map(retirement => retirement.discard()))
            this.#restartingApplications.delete(id)
          },
          complete: () => {
            this.#incrementApplicationRestartCount(id)
            this.emitAndNotify('application:restarted', id)
            this.#restartingApplications.delete(id)
          }
        }
      }

      await this.#registerApplicationSchedulerJobs(id)
      this.#incrementApplicationRestartCount(id)
      this.emitAndNotify('application:restarted', id)
    } finally {
      if (!deferred) {
        this.#restartingApplications.delete(id)
      }
    }
  }

  async buildApplication (id) {
    const application = await this.#getApplicationById(id)
    const applicationConfig = this.#applications.get(id)
    const context = Object.freeze({
      applicationId: id,
      applicationPath: applicationConfig.path
    })

    this.emitAndNotify('application:building', id)
    for (const extension of this.#extensions) {
      await extension.instance?.preBuild?.(context)
    }

    let buildHandlerMissing = false
    const build = this.#extensions.reduceRight(
      (next, extension) => {
        if (typeof extension.instance?.onBuild !== 'function') {
          return next
        }

        return () => {
          let called = false
          const build = () => {
            if (called) {
              throw new RuntimeExtensionBuildAlreadyCalledError()
            }

            called = true
            return next()
          }

          return extension.instance.onBuild(context, build)
        }
      },
      async () => {
        try {
          return await sendViaITC(application, 'build')
        } catch (e) {
          // The application exports no meta, return an empty object
          if (e.code === 'PLT_ITC_HANDLER_NOT_FOUND') {
            buildHandlerMissing = true
            return {}
          }

          throw e
        }
      }
    )

    const result = await build()

    for (const extension of [...this.#extensions].reverse()) {
      await extension.instance?.postBuild?.(context, result)
    }

    if (!buildHandlerMissing) {
      this.emitAndNotify('application:built', id)
    }
    return result
  }

  async startApplicationProfiling (id, options = {}, ensureStarted = true) {
    this.#validatePprofCapturePreload()

    const { allWorkers, ...profilingOptions } = options

    if (!allWorkers || hasWorkerIndex(id)) {
      const service = await this.#getApplicationWorkerForProfiling(id, ensureStarted)
      return sendViaITC(service, 'startProfiling', profilingOptions)
    }

    const started = []
    const alreadyProfiling = []
    let firstError

    for (const { workerIndex, worker } of await this.#getApplicationWorkersForProfiling(id, ensureStarted)) {
      try {
        await sendViaITC(worker, 'startProfiling', profilingOptions)
        started.push(workerIndex)
      } catch (error) {
        // A worker which is already being profiled is considered covered, but
        // if no other worker could be started the error is still reported.
        if (error.code === 'PLT_PPROF_PROFILING_ALREADY_STARTED') {
          alreadyProfiling.push(workerIndex)
        }

        firstError ??= error
      }
    }

    if (started.length === 0 && firstError) {
      throw firstError
    }

    return { workers: started.concat(alreadyProfiling).sort((a, b) => a - b) }
  }

  async stopApplicationProfiling (id, options = {}, ensureStarted = true) {
    this.#validatePprofCapturePreload()

    const { allWorkers, ...profilingOptions } = options

    if (!allWorkers || hasWorkerIndex(id)) {
      const service = await this.#getApplicationWorkerForProfiling(id, ensureStarted)
      return sendViaITC(service, 'stopProfiling', profilingOptions)
    }

    const profiles = []
    let firstError

    for (const { workerIndex, worker } of await this.#getApplicationWorkersForProfiling(id, ensureStarted)) {
      try {
        const profile = await sendViaITC(worker, 'stopProfiling', profilingOptions)
        profiles.push({ workerIndex, profile })
      } catch (error) {
        firstError ??= error
      }
    }

    if (profiles.length === 0 && firstError) {
      throw firstError
    }

    return profiles
  }

  async getApplicationLastProfile (id, options = {}, ensureStarted = true) {
    this.#validatePprofCapturePreload()

    const type = options.type ?? 'cpu'
    const timeout = options.timeout ?? kLastProfileTimeoutMs
    let error

    try {
      // Bound the whole retrieval with a single timeout budget: resolving the
      // workers round-trips to them when ensureStarted is set, and the profile
      // pulls do too — both hang if a worker event loop is blocked. Attach
      // a noop handler so that a late settlement after the timeout does not
      // surface as an unhandled rejection.
      const pull = this.#pullLastProfiles(id, options, ensureStarted)
      pull.catch(() => {})

      const outcome = await executeWithTimeout(pull, timeout, kTimeout)

      if (outcome !== kTimeout) {
        let best = null

        for (const { service, result } of outcome) {
          // An older capture module which does not support includeTimestamp
          // returns the raw profile.
          const value = result instanceof Uint8Array
            ? { profile: result, timestamp: null, sampleCount: null }
            : { sampleCount: null, ...result }

          // A strictly newer live window supersedes the preserved overload
          // profile: prune it so the preserved copy naturally expires once the
          // worker is healthy again and its profiles are being consumed.
          if (value.timestamp != null) {
            const key = `${service[kApplicationId]}:${service[kWorkerId]}:${type}`
            const preserved = this.#lastOverloadProfiles.get(key)

            if (preserved && preserved.timestamp < value.timestamp) {
              this.#lastOverloadProfiles.delete(key)
            }
          }

          // For an application-level id the newest window across the workers
          // wins, mirroring the preserved overload profile fallback below.
          if (!best || (value.timestamp != null && (best.timestamp == null || value.timestamp > best.timestamp))) {
            best = value
          }
        }

        return { ...best, preserved: false }
      }

      // The worker event loop is not responding (e.g. it is hard-blocked).
      error = new LastProfileTimeoutError(id)
    } catch (e) {
      if (!kLastProfileFallbackCodes.has(e.code)) {
        throw e
      }

      error = e
    }

    const preserved = this.#getPreservedOverloadProfile(id, type)

    if (preserved) {
      // The preserved flag lets consumers distinguish post-mortem evidence
      // from a live window and judge it together with the timestamp.
      return {
        profile: preserved.profile,
        timestamp: preserved.timestamp,
        sampleCount: preserved.sampleCount,
        preserved: true
      }
    }

    throw error
  }

  // Pulls the last profile from the addressed worker, or from every worker of
  // the application when no explicit worker index is given: the application
  // "last profile" is the newest window among its workers, so one arbitrary
  // worker cannot answer for all of them. Per-worker failures with fallback
  // codes are ignored as long as at least one worker yields a profile.
  async #pullLastProfiles (id, options, ensureStarted) {
    const pullOptions = { ...options, includeTimestamp: true, includeSampleCount: true }

    const pullWorker = async service => {
      const result = await sendViaITC(service, 'getLastProfile', pullOptions)
      return { service, result }
    }

    if (/^.+:\d+$/.test(id)) {
      return [await pullWorker(await this.#getApplicationById(id, ensureStarted))]
    }

    if (!this.#applications.has(id)) {
      throw new ApplicationNotFoundError(id, this.getApplicationsIds().join(', '))
    }

    const keys = this.#workers.getKeys(id)

    // No worker is currently registered: resolve the id as usual so that the
    // canonical error is raised.
    if (keys.length === 0) {
      return [await pullWorker(await this.#getApplicationById(id, ensureStarted))]
    }

    const settled = await Promise.allSettled(
      keys.map(async key => {
        const service = await this.#getWorkerByIdOrNext(id, key.split(':')[1], ensureStarted)
        return pullWorker(service)
      })
    )

    const profiles = []
    let firstError

    for (const outcome of settled) {
      if (outcome.status === 'fulfilled') {
        profiles.push(outcome.value)
      } else if (!kLastProfileFallbackCodes.has(outcome.reason?.code)) {
        throw outcome.reason
      } else {
        firstError ??= outcome.reason
      }
    }

    if (profiles.length === 0) {
      throw firstError
    }

    return profiles
  }

  // The final profile of an overload pause is pushed by the worker and
  // preserved in the main thread (see the profile:overload listener), so that
  // the evidence of what saturated a worker survives the worker being blocked
  // or replaced.
  #getPreservedOverloadProfile (id, type) {
    if (id.includes(':')) {
      return this.#lastOverloadProfiles.get(`${id}:${type}`)
    }

    // Application-level id: return the most recent profile among its workers
    let latest = null
    for (const [key, entry] of this.#lastOverloadProfiles) {
      if (key.startsWith(`${id}:`) && key.endsWith(`:${type}`) && (!latest || entry.timestamp > latest.timestamp)) {
        latest = entry
      }
    }

    return latest
  }

  async takeApplicationHeapSnapshot (id, ensureStarted = true) {
    const service = await this.#getApplicationById(id, ensureStarted)

    const { port1, port2 } = new MessageChannel()

    const readable = new Readable({ read () {} })

    port2.on('message', (message) => {
      if (message.type === 'chunk') {
        readable.push(message.chunk)
      } else if (message.type === 'error') {
        readable.destroy(new Error(message.message))
        port2.close()
      } else if (message.type === 'end') {
        readable.push(null)
        port2.close()
      }
    })

    await sendViaITC(service, 'takeHeapSnapshot', port1, [port1])

    return readable
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

    if (this.#healthProbesServer) {
      await this.#healthProbesServer.close()
      this.#healthProbesServer = null
    }

    if (this.#opentelemetryMetricsForwarder) {
      await this.#opentelemetryMetricsForwarder.close()
      this.#opentelemetryMetricsForwarder = null
    }

    this.#config.metrics = metricsConfig
    this.#metricsLabelName = metricsConfig?.applicationLabel || 'applicationId'

    // Allow extension health routes to be re-applied on the restarted servers.
    for (const entry of this.#extensionHealthRoutes) {
      entry.applied = false
    }

    this.#prometheusServer = await startPrometheusServer(this, metricsConfig, this.#config.healthProbes)

    this.#healthProbesServer = await startHealthProbesServer(this, metricsConfig, this.#config.healthProbes)
    this.#assertExtensionHealthRoutesApplied()

    await this.#startOpenTelemetryMetricsForwarder(metricsConfig?.opentelemetry)

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

  async #startOpenTelemetryMetricsForwarder (config) {
    if (!config?.endpoint || config.enabled === false || config.enabled === 'false') {
      return
    }

    const forwarder = new OpenTelemetryMetricsForwarder(config, this.logger)
    if (await forwarder.start()) {
      this.#opentelemetryMetricsForwarder = forwarder
    }
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

  getUrls (applicationId) {
    const urls = {}
    const applicationIds = applicationId ? [applicationId] : this.#applications.keys()

    for (const id of applicationIds) {
      for (const workerId of this.#workers.getKeys(id)) {
        const url = this.#workers.get(workerId)?.[kWorkerUrl]
        if (url) {
          urls[workerId] = url
        }
      }
    }

    return urls
  }

  getRuntimeStatus () {
    return this.#status
  }

  async getRuntimeMetadata () {
    const packageJson = await this.#getRuntimePackageJson()
    return {
      pid: process.pid,
      cwd: process.cwd(),
      argv: process.argv,
      uptimeSeconds: Math.floor(process.uptime()),
      execPath: process.execPath,
      nodeVersion: process.version,
      projectDir: this.#root,
      /*
        What `applications:add`/`remove --save` actually consume, so they can stop reading the whole
        runtime configuration over HTTP to get at three values. `autoload` is the declaration as
        authored, not the expansion: v4 expands it in the eval worker, and --save has to edit what
        the file says rather than what it produced.
      */
      configPath: this.#config[kMetadata]?.path ?? null,
      autoload: this.#config.autoload ?? null,
      packageName: packageJson.name ?? null,
      packageVersion: packageJson.version ?? null,
      platformaticVersion: version,
      urls: this.getUrls()
    }
  }

  getRuntimeEnv () {
    return this.#env
  }

  /*
    What a watcher has to follow to know this configuration changed. v4 reports the whole set the
    evaluation read; v3 resolves per worker and has no such set, so it is the deciding file alone --
    which is what dev watched before either way.
  */
  getConfigurationWatchTargets () {
    const metadata = this.#config[kMetadata]
    const targets = metadata?.v4?.watchTargets

    if (targets) {
      return { files: [...targets.files], directories: [...targets.directories] }
    }

    return { files: metadata?.path ? [metadata.path] : [], directories: [] }
  }

  getRuntimeConfig (includeMeta = false) {
    // includeMeta is an internal contract and hands back live state, symbol key and all. It leaves
    // the public surface with the DTO change; until then, its in-tree callers depend on identity.
    if (includeMeta) {
      return this.#config
    }

    const { [kMetadata]: _, ...config } = this.#config
    return frozenSnapshot(config)
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

  /*
    servingState is computed per worker: for a worker-classified capability it depends on what the
    application's factory returned in *that* worker, and nothing stops arbitrary code from returning
    a server from worker 0 and a background result from worker 1. Sampling one worker -- which is
    what getApplicationDetails does for every other field -- would make the reported value depend on
    which worker the selector picked, and, worse, would leave mesh dispatch routing a share of
    requests to a worker that destroys them. So every worker answers and a mixed answer is refused,
    naming each worker and the state it reported.
  */
  async #collectServingState (id) {
    const invocations = this.#workers.getKeys(id).map(workerId => [workerId, this.#workers.get(workerId)])

    if (invocations.length === 0) {
      this.#servingStates.delete(id)
      return
    }

    const states = await sendMultipleViaITC(invocations, 'getServingState', undefined, [], this.#concurrency)
    const reported = Object.entries(states).filter(([, state]) => typeof state === 'string')

    if (reported.length === 0) {
      this.#servingStates.delete(id)
      return
    }

    const distinct = new Set(reported.map(([, state]) => state))

    if (distinct.size > 1) {
      this.#servingStates.delete(id)
      throw new MixedServingStateError(id, reported.map(([worker, state]) => `${worker} reported ${state}`).join(', '))
    }

    this.#servingStates.set(id, reported[0][1])
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
      this.#getHealthChecksTimeout(),
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
      this.#getHealthChecksTimeout(),
      {}
    )
  }

  getExtensionHealthRoutes () {
    return this.#extensionHealthRoutes
  }

  async runExtensionReadinessChecks () {
    return this.#runExtensionHealthChecks(this.#extensionReadinessChecks, 'readiness')
  }

  async runExtensionLivenessChecks () {
    return this.#runExtensionHealthChecks(this.#extensionLivenessChecks, 'liveness')
  }

  async getMetrics (format = 'json') {
    if (this.#config.metrics === false || this.#config.metrics?.enabled === false) {
      throw new Error('Metrics are disabled')
    }

    let metrics = null

    const applicationRestartMetrics = this.#getApplicationRestartMetricsJson()

    // Get process-level metrics once from main thread registry (if available)
    let processMetricsJson = null
    if (this.#processMetricsRegistry) {
      processMetricsJson = await this.#processMetricsRegistry.getMetricsAsJSON()
    }

    // Collect main-thread extension metrics once. Each extension has its own
    // registry so metric registration and cleanup stay isolated. Collisions
    // with other extensions, process metrics, restart metrics, or worker
    // metrics fail with a coded error identifying the extension and family.
    const extensionMetrics = await this.#getExtensionMetricsJson({
      processMetricsJson,
      applicationRestartMetrics
    })

    for (const worker of this.#workers.values()) {
      try {
        // The application might be temporarily unavailable
        if (worker[kWorkerStatus] !== 'started') {
          continue
        }

        // Get thread-specific metrics from worker. Always collect JSON so that
        // the text format can be serialized once with a single HELP/TYPE block
        // per metric family, as required by the Prometheus exposition format.
        const applicationMetrics = await executeWithTimeout(
          sendViaITC(worker, 'getMetrics', 'json'),
          this.#config.metrics?.timeout ?? 10000
        )

        if (applicationMetrics && applicationMetrics !== kTimeout) {
          metrics ??= []

          // Add worker's thread-specific metrics
          for (let i = 0; i < applicationMetrics.length; i++) {
            metrics.push(applicationMetrics[i])
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

    // Extension metrics must not share a family name with any worker metric.
    if (metrics !== null && extensionMetrics.length > 0) {
      const workerMetricNames = new Set()
      for (let i = 0; i < metrics.length; i++) {
        workerMetricNames.add(metrics[i].name)
      }

      for (const { path, metricNames } of extensionMetrics) {
        for (const name of metricNames) {
          if (workerMetricNames.has(name)) {
            throw new MetricFamilyCollisionError(path, name, 'application worker metrics')
          }
        }
      }
    }

    if (extensionMetrics.length > 0) {
      metrics ??= []
      const extensionMetricsJson = []
      for (const { metrics: extensionMetricList } of extensionMetrics) {
        extensionMetricsJson.push(...extensionMetricList)
      }
      metrics = [...extensionMetricsJson, ...metrics]
    }

    // Report process-level metrics (e.g. process_resident_memory_bytes) only once:
    // they describe the whole runtime process, so replicating them for each
    // application running in a worker thread would just duplicate the same value.
    // Applications running as separate OS processes report their own process-level
    // metrics, with their own labels, as part of their thread metrics above.
    // See https://github.com/platformatic/platformatic/issues/3332.
    if (metrics !== null && processMetricsJson) {
      const processMetrics = []
      // Drop any configured custom label that shares the name of the application
      // label (a config can set both `applicationLabel: 'serviceId'` and a static
      // `serviceId` label): keeping it would make these runtime-wide metrics look
      // like they belong to an application during metrics aggregation.
      const processLabels = { ...this.#config.metrics?.labels }
      delete processLabels[this.#metricsLabelName]
      this.#applyLabelsToMetrics(processMetricsJson, processLabels, processMetrics)
      metrics = [...processMetrics, ...metrics]
    }

    if (metrics !== null && applicationRestartMetrics.length > 0) {
      metrics = [...applicationRestartMetrics, ...metrics]
    }

    if (metrics !== null && format !== 'json') {
      metrics = this.#formatMetricsAsText(metrics)
    }

    return { metrics }
  }

  async #getExtensionMetricsJson ({ processMetricsJson, applicationRestartMetrics }) {
    const results = []
    const metricSources = new Map()

    // Static labels from metrics config apply, but Runtime never invents a
    // worker ID or application ID for main-thread extension metrics.
    const extensionLabels = typeof this.#config.metrics === 'object' && this.#config.metrics
      ? { ...this.#config.metrics.labels }
      : {}
    delete extensionLabels[this.#metricsLabelName]

    const processMetricNames = new Set((processMetricsJson ?? []).map(metric => metric.name))
    const restartMetricNames = new Set((applicationRestartMetrics ?? []).map(metric => metric.name))

    for (const { path, registry } of this.#extensions) {
      if (!registry) {
        continue
      }

      const registryMetrics = await registry.getMetricsAsJSON()
      if (!registryMetrics || registryMetrics.length === 0) {
        continue
      }

      const metricNames = []
      for (const metric of registryMetrics) {
        const existing = metricSources.get(metric.name)
        if (existing) {
          throw new MetricFamilyCollisionError(path, metric.name, `extension "${existing}"`)
        }

        if (processMetricNames.has(metric.name)) {
          throw new MetricFamilyCollisionError(path, metric.name, 'runtime process metrics')
        }

        if (restartMetricNames.has(metric.name)) {
          throw new MetricFamilyCollisionError(path, metric.name, 'runtime restart metrics')
        }

        metricSources.set(metric.name, path)
        metricNames.push(metric.name)
      }

      const labeledMetrics = []
      this.#applyLabelsToMetrics(registryMetrics, extensionLabels, labeledMetrics)
      results.push({ path, metrics: labeledMetrics, metricNames })
    }

    return results
  }

  #incrementApplicationRestartCount (applicationId) {
    this.#applicationRestartCounts.set(applicationId, (this.#applicationRestartCounts.get(applicationId) ?? 0) + 1)
  }

  #getApplicationRestartMetricLabels (applicationId) {
    return {
      ...this.#config.metrics?.labels,
      [this.#metricsLabelName]: applicationId
    }
  }

  #getApplicationRestartMetricsJson () {
    const metrics = []

    for (const applicationId of this.#applications.keys()) {
      metrics.push({
        name: kApplicationRestartsMetricName,
        help: kApplicationRestartsMetricHelp,
        type: 'counter',
        aggregator: 'sum',
        values: [{
          value: this.#applicationRestartCounts.get(applicationId) ?? 0,
          labels: this.#getApplicationRestartMetricLabels(applicationId),
          metricName: kApplicationRestartsMetricName
        }]
      })
    }

    return metrics
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

  // Serialize JSON metrics to the Prometheus text exposition format.
  // Samples are grouped by metric family so each family is emitted as a single
  // block with one HELP/TYPE header: the format forbids repeating them, and
  // strict parsers (e.g. OpenMetrics-based ones like Dynatrace) would otherwise
  // only ingest the first block for each metric name.
  #formatMetricsAsText (metricsJson) {
    const families = new Map()

    for (const metric of metricsJson) {
      let family = families.get(metric.name)
      if (!family) {
        family = { help: metric.help, type: metric.type, values: [] }
        families.set(metric.name, family)
      }
      family.values.push(...metric.values)
    }

    let output = ''
    for (const [name, family] of families) {
      const escapedHelp = String(family.help).replace(/\\/g, '\\\\').replace(/\n/g, '\\n')
      output += `# HELP ${name} ${escapedHelp}\n`
      output += `# TYPE ${name} ${family.type}\n`

      for (const v of family.values) {
        const labelParts = []

        for (const [key, val] of Object.entries(v.labels ?? {})) {
          // Escape label values for Prometheus format
          const escapedVal = String(val).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')
          labelParts.push(`${key}="${escapedVal}"`)
        }

        const labelStr = labelParts.length > 0 ? `{${labelParts.join(',')}}` : ''
        const metricName = v.metricName || name
        output += `${metricName}${labelStr} ${formatMetricValue(v.value)}\n`
      }
    }

    return output
  }

  getSharedContext () {
    return this.#sharedContext
  }

  async getApplicationResourcesInfo (id) {
    const workersCount = this.#workers.getKeys(id).length
    // Use round-robin to get any available worker instead of assuming index 0 exists
    const worker = await this.#getWorkerByIdOrNext(id, null, false, false)
    const health = worker[kConfig].health

    return { workers: workersCount, health }
  }

  getApplicationsIds () {
    return Array.from(this.#applications.keys()).sort()
  }

  async getApplications (allowUnloaded = false) {
    return frozenSnapshot({
      production: this.#isProduction,
      applications: await Promise.all(
        this.getApplicationsIds().map(id => this.#buildApplicationDetails(id, allowUnloaded))
      )
    })
  }

  async getApplicationDetails (id, allowUnloaded = false) {
    return frozenSnapshot(await this.#buildApplicationDetails(id, allowUnloaded))
  }

  async getApplicationMeta (id) {
    const hasWorkerId = /^.+:\d+$/.test(id)
    const attempts = hasWorkerId ? 1 : Math.max(1, this.#workers.getKeys(id).length)

    for (let attempt = 0; attempt < attempts; attempt++) {
      const application = await this.#getApplicationById(id)

      try {
        return await sendViaITC(application, 'getApplicationMeta')
      } catch (e) {
        // The application exports no meta, return an empty object
        if (e.code === 'PLT_ITC_HANDLER_NOT_FOUND') {
          return {}
        }

        // A parallel restart can stop the selected worker while metadata is
        // being retrieved. Retry another worker unless one was requested
        // explicitly or every worker available at the start has been tried.
        if (e.code !== 'PLT_RUNTIME_APPLICATION_WORKER_EXIT' || attempt === attempts - 1) {
          throw e
        }
      }
    }
  }

  async #buildApplicationDetails (id, allowUnloaded = false) {
    let application

    try {
      application = await this.#getApplicationById(id)
    } catch (e) {
      if (allowUnloaded) {
        return { id, status: 'stopped' }
      }

      throw e
    }

    const { localUrl, config, configPath, path } = application[kConfig]

    const sourceMaps = application[kConfig].sourceMaps ?? this.#config.sourceMaps
    const status = await sendViaITC(application, 'getStatus')
    const { type, version, dependencies } = await sendViaITC(application, 'getApplicationInfo')

    const applicationDetails = {
      id,
      type,
      path,
      status,
      dependencies,
      version,
      localUrl,
      sourceMaps
    }

    /*
      v3's `config` was the application's configuration file path. v4 evaluates that file main-side
      and hands the worker the payload, so the path becomes `configPath` and the entry's own
      `config` is no longer a path to report. Emitting the key that matches the dialect keeps a
      consumer from reading one and silently getting the other.
    */
    if (typeof config === 'string') {
      applicationDetails.config = config
    } else if (configPath) {
      applicationDetails.configPath = configPath
    }

    // status is worker lifecycle; servingState is how the thing serves. They are different
    // questions, and the runtime gates URL emission on status === 'started', so they cannot share
    // a field.
    const servingState = this.#servingStates.get(id)

    if (servingState) {
      applicationDetails.servingState = servingState
    }

    if (this.#isProduction) {
      applicationDetails.workers = this.#workers.getKeys(id).length
    }

    const urls = status === 'started' ? Object.values(this.getUrls(id)) : []
    applicationDetails.urls = urls
    applicationDetails.url = urls[0] ?? null

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

  async getApplicationScheduledTasks (id) {
    const application = await this.#getApplicationById(id, true)

    return sendViaITC(application, 'getApplicationScheduledTasks')
  }

  async runApplicationScheduledTasks (id, scheduleId, scheduledTime) {
    const application = await this.#getApplicationById(id, true)

    return sendViaITC(application, 'runApplicationScheduledTasks', { scheduleId, scheduledTime })
  }

  getSchedulerJobs () {
    return this.#scheduler?.getJobs() ?? []
  }

  pauseSchedulerJob (name) {
    return this.#schedulerOrThrow().pauseJob(name)
  }

  resumeSchedulerJob (name) {
    return this.#schedulerOrThrow().resumeJob(name)
  }

  runSchedulerJob (name) {
    return this.#schedulerOrThrow().runJob(name)
  }

  #schedulerOrThrow () {
    if (!this.#scheduler) {
      throw new Error('The scheduler is not configured')
    }

    return this.#scheduler
  }

  async #registerApplicationSchedulerJobs (id) {
    if (!this.#scheduler) {
      return
    }

    const pausedJobs = new Set(
      this.#scheduler
        .getJobs()
        .filter(job => job.applicationId === id && job.paused)
        .map(job => job.name)
    )

    await this.#scheduler.removeApplicationJobs(id)

    const workerId = this.#workers.getKeys(id)[0]
    const schedules = this.#workers.get(workerId)?.[kWorkerScheduledTasks] ?? []
    for (const schedule of schedules) {
      const name = `${id}:${schedule.id}`
      this.#scheduler.addJob(
        {
          name,
          cron: schedule.cron,
          source: 'application',
          applicationId: id,
          scheduleId: schedule.id,
          tasks: schedule.tasks,
          maxRetries: 3
        },
        ({ scheduledTime }) => this.runApplicationScheduledTasks(id, schedule.id, scheduledTime)
      )

      if (pausedJobs.has(name)) {
        await this.#scheduler.pauseJob(name)
      }
    }
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
        url: worker[kWorkerUrl] ?? null,
        raw: includeRaw ? worker : undefined
      }
    }

    return status
  }

  getWorkerHealth (worker, options = {}) {
    // For subprocess workers we must round-trip through ITC to reach the child;
    // for pure worker-thread workers we can read ELU/heap directly from the
    // worker handle, which is served by Node's C++ layer and does not depend
    // on the worker's event loop being responsive. Going through ITC for
    // thread workers means a CPU-bound or stuck worker can freeze the whole
    // health-collection loop, which in turn blocks the management API.
    if (worker[kIsSubprocessHost]) {
      return this.#getSubprocessWorkerHealth(worker, options)
    }

    const currentELU = worker.performance.eventLoopUtilization()
    const previousELU = options.previousELU

    let elu = currentELU
    if (previousELU) {
      elu = worker.performance.eventLoopUtilization(elu, previousELU)
    }

    if (!features.node.worker.getHeapStatistics) {
      return { elu: elu.utilization, currentELU }
    }

    // Only refresh heap statistics every 60 health checks (once per minute).
    // This keeps the common path fully synchronous — no promise allocation.
    const counter = (worker[kHeapCheckCounter] ?? 0) + 1
    worker[kHeapCheckCounter] = counter >= 60 ? 0 : counter

    if (counter >= 60 || !worker[kLastHeapStats]) {
      return worker.getHeapStatistics().then(({ used_heap_size: heapUsed, total_heap_size: heapTotal }) => {
        worker[kLastHeapStats] = { heapUsed, heapTotal }
        return { elu: elu.utilization, heapUsed, heapTotal, currentELU }
      })
    }

    const { heapUsed, heapTotal } = worker[kLastHeapStats]
    return { elu: elu.utilization, heapUsed, heapTotal, currentELU }
  }

  async #getSubprocessWorkerHealth (worker, options) {
    // Bound the ITC call so a hung child cannot freeze the health loop.
    // On timeout we fall back to last-known ELU with a null heap reading so
    // that the loop keeps rescheduling and signals remain observable.
    const result = await executeWithTimeout(sendViaITC(worker, 'getHealth'), kHealthITCTimeoutMs, kTimeout)

    if (result === kTimeout) {
      const previousELU = options.previousELU ?? worker.performance.eventLoopUtilization()
      return { elu: 1, heapUsed: null, heapTotal: null, currentELU: previousELU }
    }

    const { currentELU, heapUsed, heapTotal } = result
    const previousELU = options.previousELU
    let elu = currentELU
    if (previousELU) {
      elu = performance.eventLoopUtilization(currentELU, previousELU)
    }

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

  #showUrls (workerIds) {
    const whitelist = workerIds ? new Set(workerIds) : null

    for (const applicationId of this.#applications.keys()) {
      for (const workerId of this.#workers.getKeys(applicationId)) {
        if (whitelist && !whitelist.has(workerId)) {
          continue
        }

        const worker = this.#workers.get(workerId)
        const url = worker?.[kWorkerUrl]
        if (!url) {
          continue
        }

        this.logger.info(
          `Platformatic is now listening at ${url} for ${this.#workerExtendedLabel(applicationId, worker[kWorkerId])}`
        )
      }
    }
  }

  async #refuseUnresolvedApplication (id) {
    const executable = getExecutable() ?? 'platformatic'

    this.logger.error(
      `The path for application "%s" does not exist. Please run "${executable} resolve" and try again.`,
      id
    )

    await this.closeAndThrow(new RuntimeAbortedError())
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
          await this.#refuseUnresolvedApplication(id)
        }
      } else {
        this.logger.error(
          'The application "%s" has no path defined. Please check your configuration and try again.',
          id
        )

        await this.closeAndThrow(new RuntimeAbortedError())
      }
    } else if (applicationConfig.unresolved) {
      /*
        A remote application that declares where its clone belongs, and whose clone is not there --
        either the directory is missing or it holds no application at all. The pathless case above
        is the same state said differently, and both are what `resolve` exists to fix, so both get
        the message that names it rather than the capability detector's report that the directory
        holds nothing.
      */
      await this.#refuseUnresolvedApplication(id)
    }

    let workers = applicationConfig.workers.static
    const setupInvocations = []

    // All the workers of the application are (re)created, so their port offsets match their indexes
    for (const workerId of this.#workerPortOffsets.keys()) {
      if (workerId.slice(0, workerId.lastIndexOf(':')) === id) {
        this.#workerPortOffsets.delete(workerId)
      }
    }

    let firstIndex = 0

    // On platforms where reusePort is not available, multiple workers cannot listen on the same fixed port.
    // The listener configuration is owned by the capability, so it can only be inspected after setting up the first
    // worker: if the application would try to share a fixed port between workers, clamp it to a single worker.
    if (!features.node.reusePort && (workers > 1 || applicationConfig.workers.dynamic)) {
      const worker = await this.#setupWorker(config, applicationConfig, workers, id, 0)
      firstIndex = 1

      if (await this.#usesSharedFixedPort(worker)) {
        this.logger.warn(
          `The application "${id}" is configured to listen on a fixed port with multiple workers, but reusePort is not available in your OS. ${workers > 1 ? `Setting workers to 1 instead of ${workers}` : 'Disabling dynamic workers scaling'}. To run multiple workers, set "server.portAssignment" to "perWorkerIncrement" in the application configuration.`
        )

        applicationConfig.workers = { dynamic: false, static: 1 }
        workers = 1
        await sendViaITC(worker, 'updateWorkersCount', { applicationId: id, workers })
      }
    }

    for (let i = firstIndex; i < workers; i++) {
      setupInvocations.push([config, applicationConfig, workers, id, i])
    }

    await executeInParallel(this.#setupWorker.bind(this), setupInvocations, this.#concurrency)

    // Initialize the next worker index counter (next index starts after initial workers)
    this.#nextWorkerIndex.set(id, workers)

    await this.#dynamicWorkersScaler?.add(applicationConfig)
    this.emitAndNotify('application:init', id)
  }

  async #setupWorker (config, applicationConfig, workersCount, applicationId, index, enabled = true, attempt = 0) {
    const restartOnError = this.#getApplicationRestartOnError(config, applicationConfig)
    const workerId = `${applicationId}:${index}`

    // The port offset is the slot the worker occupies when the application uses server.portAssignment=perWorkerIncrement.
    // It matches the worker index unless the worker was created to replace another one, in which case it inherits its offset.
    const portOffset = this.#workerPortOffsets.get(workerId) ?? index
    this.#workerPortOffsets.set(workerId, portOffset)

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

    // v4 resolves each application's worker environment main-side, with its own env-file chain, the
    // two env blocks and the injected topology URLs. v3 seeded every worker from one loadEnv at the
    // runtime root, which is what #env still holds.
    const workerEnv = structuredClone(applicationConfig.workerEnv ?? this.#env)

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

    const workerConfig = { ...config, preload }

    const worker = new Worker(kWorkerFile, {
      workerData: {
        config: workerConfig,
        meshId: this.#meshId,
        applicationConfig: {
          ...applicationConfig,
          isProduction: this.#isProduction,
          configPatch: this.#applicationsConfigsPatches.get(applicationId)
        },
        worker: {
          id: workerId,
          index,
          count: workersCount,
          portOffset
        },
        resourceLimits: {
          maxOldGenerationSizeMb,
          maxYoungGenerationSizeMb,
          codeRangeSizeMb
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

            this.#restartCrashedWorker(
              config,
              applicationConfig,
              workersCount,
              applicationId,
              index,
              false,
              0,
              worker[kWorkerPortOffset]
            ).catch(err => {
              this.logger.error({ err: ensureLoggableError(err) }, `${errorLabel} could not be restarted.`)
            })
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
    worker[kWorkerPortOffset] = portOffset
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

    // Register management ITC handlers for privileged applications
    if (applicationConfig.management) {
      const mgmtEnabled = typeof applicationConfig.management === 'boolean'
        ? applicationConfig.management
        : applicationConfig.management.enabled !== false

      if (mgmtEnabled) {
        const allowedOps = typeof applicationConfig.management === 'object'
          ? applicationConfig.management.operations
          : undefined

        const handlers = createManagementHandlers(this, allowedOps)
        for (const [name, handler] of handlers) {
          worker[kITC].handle(name, handler)
        }
      }
    }

    worker[kITC].listen()

    // Forward events from the worker
    // Do not use emitAndNotify here since we don't want to forward unknown events
    worker[kITC].on('event', ({ event, payload }) => {
      if (event === 'serverOptions') {
        worker[kWorkerServerOptions] = payload[0]
      }

      event = `application:worker:event:${event}`

      this.emit(event, ...payload, workerId, applicationId, index)
      this.logger.trace({ event, payload, id: workerId, application: applicationId, worker: index }, 'Runtime event')
    })

    // The worker notifies us when its capability has spawned a child process
    // (e.g. Next.js in dev mode). From that point on health metrics must come
    // from the child via ITC; for thread-only workers we keep reading the
    // handle directly in getWorkerHealth().
    worker[kITC].on('subprocess:started', () => {
      worker[kIsSubprocessHost] = true
    })

    worker[kITC].on(openTelemetryITCMessage, resourceMetrics => {
      this.#opentelemetryMetricsForwarder?.collect(resourceMetrics)
    })

    // The continuous profiler notifies us when a profile window is completed.
    // The event only carries metadata: the profile can be retrieved on demand
    // via getApplicationLastProfile. We use emit instead of emitAndNotify since
    // other workers are not interested in this event.
    worker[kITC].on('profile:captured', ({ type, timestamp, sampleCount }) => {
      // A strictly newer completed window supersedes the preserved overload
      // profile: once the worker is past the overload and producing windows
      // again, its old evidence must not be served anymore.
      const preservedKey = `${workerId}:${type}`
      const preservedEntry = this.#lastOverloadProfiles.get(preservedKey)

      if (preservedEntry && preservedEntry.timestamp < timestamp) {
        this.#lastOverloadProfiles.delete(preservedKey)
      }

      this.emit('application:worker:profile:captured', {
        id: workerId,
        application: applicationId,
        worker: index,
        type,
        timestamp,
        sampleCount: sampleCount ?? null
      })
    })

    // The continuous profiler registers its gating needs when profiling starts.
    // The main thread drives it based on the ELU measured by the health
    // metrics cycle (see #applyProfilingELUGates): when an ELU threshold is
    // set the profiler starts paused and only runs while the ELU is above it,
    // and continuous profiling is paused while the worker ELU is above the
    // maxELU cutoff so that profiling does not add overhead to an already
    // overloaded worker. This is a request handler rather than a notification
    // listener on purpose: the capture module can detect a runtime without
    // the driver (PLT_ITC_HANDLER_NOT_FOUND) and fall back to ungated
    // profiling instead of starting paused forever.
    worker[kITC].handle('profiling:started', ({ type, eluThreshold, maxELU, continuous }) => {
      // Resolve the overload cutoff: the maxELU profiling option overrides it
      // (false disables it), otherwise continuous profiling defaults to the
      // worker health.maxELU.
      let overloadELU = null
      if (typeof maxELU === 'number') {
        overloadELU = maxELU
      } else if (maxELU !== false && continuous) {
        const healthConfig = worker[kConfig]?.health
        const configMaxELU = Number(healthConfig?.maxELU)

        if (healthConfig?.enabled !== false && Number.isFinite(configMaxELU)) {
          overloadELU = configMaxELU
        }
      }

      if (eluThreshold == null && overloadELU == null) {
        worker[kProfilingELUGates]?.delete(type)
        return true
      }

      worker[kProfilingELUGates] ??= new Map()
      worker[kProfilingELUGates].set(type, {
        eluThreshold: eluThreshold ?? null,
        maxELU: overloadELU,
        // Hysteresis memories: `wanted` tracks the eluThreshold demand,
        // `overloaded` tracks the maxELU cutoff. `running` is the last state
        // commanded to the worker: the profiler starts paused when an ELU
        // threshold is set and running otherwise.
        wanted: eluThreshold == null,
        overloaded: false,
        running: eluThreshold == null
      })
      this.#startHealthMetricsCollectionIfNeeded()

      return true
    })

    worker[kITC].on('profiling:stopped', ({ type }) => {
      worker[kProfilingELUGates]?.delete(type)
      this.#lastOverloadProfiles.delete(`${workerId}:${type}`)
    })

    // When an overload pause is applied, the worker pushes the encoded final
    // profile. It is preserved here so that the evidence of what saturated
    // the worker can be retrieved (see getApplicationLastProfile) even while
    // the worker event loop is blocked, and it survives the worker being
    // replaced by the health checks.
    worker[kITC].on('profile:overload', ({ type, timestamp, profile, sampleCount }) => {
      this.#lastOverloadProfiles.set(`${workerId}:${type}`, {
        profile,
        timestamp,
        sampleCount: sampleCount ?? null
      })
    })

    // Preserved overload profiles outlive their worker only for a grace
    // period of twice the runtime graceful shutdown timeout: post-mortem
    // collectors (alert or health-event driven) have time to fetch the
    // evidence, but a long-dead worker's profile is not served forever and
    // entries cannot pile up across replacements (replacement workers get
    // fresh indices, so their keys are never reused).
    worker.on('exit', () => {
      for (const type of ['cpu', 'heap']) {
        const key = `${workerId}:${type}`
        const entry = this.#lastOverloadProfiles.get(key)

        if (!entry) {
          continue
        }

        const gracefulShutdown = Number(this.#config?.gracefulShutdown?.runtime)
        const grace = Number.isFinite(gracefulShutdown) && gracefulShutdown > 0 ? gracefulShutdown * 2 : 20_000

        setTimeout(() => {
          // Only delete the exact entry scheduled here: a successor worker
          // reusing the index may have preserved a newer profile meanwhile.
          if (this.#lastOverloadProfiles.get(key) === entry) {
            this.#lastOverloadProfiles.delete(key)
          }
        }, grace).unref()
      }
    })

    worker[kITC].on('request:restart', async () => {
      // Do not restart applications that are not fully started yet or when the runtime is still starting.
      // The gateway sends request:restart when it receives application:added events,
      // which can arrive while the worker is still in the starting phase.
      if (this.#status !== 'started' || worker[kWorkerStatus] !== 'started') {
        return
      }

      try {
        await this.restartApplication(applicationId)
      } catch (e) {
        this.logger.error(e)
      }
    })

    // Only activate watch for the first instance. Replacement workers get unique
    // indices, so preserve the listener when replacing a single-worker app.
    if (index === 0 || workersCount === 1) {
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

          this.#showUrls(this.#workers.getKeys(applicationId))
        } catch (e) {
          this.logger.error(e)
        }
      })
    }

    if (enabled) {
      // Store locally
      this.#workers.set(workerId, worker)
    }

    // Wait for initialization
    try {
      await waitEventFromITC(worker, 'init')
    } catch (e) {
      if (attempt === MAX_BOOTSTRAP_ATTEMPTS) {
        const error = new RuntimeAbortedError({ cause: e })
        error.message = `Unable to initialize the ${errorLabel}.`
        throw error
      }

      if (e.code !== 'PLT_RUNTIME_APPLICATION_WORKER_EXIT') {
        this.logger.error(
          { err: ensureLoggableError(e) },
          `Failed to initialize the ${errorLabel}. Attempting to initialize a new worker ...`
        )
      }

      this.#workers.delete(workerId)
      // The exit handler of the failed worker might have removed the port offset, restore it for the next attempt
      this.#workerPortOffsets.set(workerId, portOffset)
      return this.#setupWorker(config, applicationConfig, workersCount, applicationId, index, enabled, attempt + 1)
    }

    worker[kConfig] = { ...applicationConfig, health, workers: workersCount }
    worker[kWorkerStatus] = 'init'
    this.emitAndNotify('application:worker:init', eventPayload)

    return worker
  }

  #startHealthMetricsCollectionIfNeeded () {
    if (this.#healthMetricsCollectionActive || this.#status !== 'started') {
      return
    }

    // Need health metrics if dynamic workers scaler exists (for vertical scaling),
    // if an extension subscribed to them, if any worker has health checks enabled
    // or if any worker runs ELU-gated continuous profiling
    let needsHealthMetrics = !!this.#dynamicWorkersScaler || this.#extensionsWantHealthMetrics

    if (!needsHealthMetrics) {
      for (const worker of this.#workers.values()) {
        const healthConfig = worker[kConfig]?.health
        if (healthConfig?.enabled && this.#getApplicationRestartOnError(this.#config, worker[kConfig]) > 0) {
          needsHealthMetrics = true
          break
        }

        if (worker[kProfilingELUGates]?.size > 0) {
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
    this.#healthMetricsCollectionActive = true

    const collectHealthMetrics = async () => {
      if (this.#status !== 'started') {
        this.#healthMetricsCollectionActive = false
        return
      }

      // Collect health from all workers in parallel so that a slow ITC
      // round-trip (e.g. subprocess timeout) does not block every other worker.
      const pending = []
      for (const worker of this.#workers.values()) {
        if (worker[kWorkerStatus] !== 'started') {
          continue
        }

        pending.push((async () => {
          const id = worker[kApplicationId]
          const index = worker[kWorkerId]
          const errorLabel = this.#workerExtendedLabel(id, index, worker[kConfig].workers)
          const previousELU = worker[kLastHealthCheckELU]

          let health = null
          try {
            health = await this.getWorkerHealth(worker, { previousELU })
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

          // Drive the ELU gating of the continuous profiler. The first sample
          // is skipped as it reports the utilization since the thread started
          // rather than over the last collection interval.
          if (health && previousELU != null) {
            this.#applyProfilingELUGates(worker, health.elu)
          }
        })())
      }

      await Promise.allSettled(pending)

      // Reschedule the next check. We are not using .refresh() because it's more
      // expensive (weird).
      this.#healthMetricsTimer = setTimeout(collectHealthMetrics, 1000).unref()
    }

    // Start the collection
    this.#healthMetricsTimer = setTimeout(collectHealthMetrics, 1000).unref()
  }

  // Drive the ELU gating of the continuous profiler from the main thread.
  // The health metrics cycle measures the worker ELU (without depending on the
  // worker's event loop being responsive, and consistently with health checks)
  // and resumes/pauses the in-worker profiler accordingly. The profiler runs
  // while the ELU is above the eluThreshold demand (if one is set) and below
  // the maxELU overload cutoff (if one is set): crossing the cutoff captures
  // one last profile and pauses profiling until the worker recovers, so that
  // profiling does not add overhead to an already overloaded worker.
  #applyProfilingELUGates (worker, elu) {
    const gates = worker[kProfilingELUGates]

    if (!gates?.size || typeof elu !== 'number') {
      return
    }

    for (const [type, gate] of gates) {
      // Hysteresis on both bounds to prevent rapid toggling: each state only
      // flips back once the ELU moves kProfilingELUHysteresis past the bound.
      if (gate.eluThreshold != null) {
        gate.wanted = gate.wanted ? elu >= gate.eluThreshold - kProfilingELUHysteresis : elu > gate.eluThreshold
      }

      if (gate.maxELU != null) {
        gate.overloaded = gate.overloaded ? elu >= gate.maxELU - kProfilingELUHysteresis : elu > gate.maxELU
      }

      const shouldRun = gate.wanted && !gate.overloaded

      if (shouldRun === gate.running) {
        continue
      }

      gate.running = shouldRun

      try {
        if (shouldRun) {
          worker[kITC].notify('resumeProfiling', { type })
        } else {
          // The reason matters to the worker: when pausing for overload it
          // keeps the final profile available for the whole pause, so that
          // consumers can still retrieve the evidence of what saturated the
          // worker.
          worker[kITC].notify('pauseProfiling', { type, reason: gate.overloaded ? 'overload' : 'threshold' })
        }
      } catch (err) {
        this.logger.error({ err }, 'Failed to toggle the continuous profiler')
      }
    }
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

    let { maxELU, maxHeapUsed, maxHeapTotal, maxUnhealthyChecks, interval, maxEventLoopDelay, maxEventLoopDelayP99 } =
      worker[kConfig].health

    if (typeof maxHeapTotal === 'string') {
      maxHeapTotal = parseMemorySize(maxHeapTotal)
    }

    maxEventLoopDelay = Number(maxEventLoopDelay)
    maxEventLoopDelayP99 = Number(maxEventLoopDelayP99)
    const eventLoopDelayEnabled = Number.isFinite(maxEventLoopDelay) && maxEventLoopDelay > 0
    const eventLoopDelayP99Enabled = Number.isFinite(maxEventLoopDelayP99) && maxEventLoopDelayP99 > 0
    const eventLoopDelayMonitored = eventLoopDelayEnabled || eventLoopDelayP99Enabled

    if (interval < 1000) {
      interval = 1000
      this.logger.warn(
        `The health check interval for the "${errorLabel}" is set to ${healthConfig.interval}ms. ` +
          'The minimum health check interval is 1s. It will be set to 1000ms.'
      )
    }

    let lastHealthMetrics = null

    // Health metrics arrive every second while the check runs every
    // `interval`: track the maximum event loop delay (and the worst reported
    // per-second p99) across the whole check window, so that stalls between
    // checks are not missed.
    let maxObservedEventLoopDelay = 0
    let maxObservedEventLoopDelayP99 = 0

    healthMetricsListener = healthCheck => {
      if (healthCheck.id === worker[kId]) {
        lastHealthMetrics = healthCheck

        if (eventLoopDelayMonitored) {
          for (const signal of healthCheck.healthSignals) {
            if (signal.type !== 'eventLoopDelay') {
              continue
            }

            if (signal.max > maxObservedEventLoopDelay) {
              maxObservedEventLoopDelay = signal.max
            }

            if (signal.p99 > maxObservedEventLoopDelayP99) {
              maxObservedEventLoopDelayP99 = signal.p99
            }
          }
        }
      }
    }

    this.on('application:worker:health:metrics', healthMetricsListener)

    let unhealthyChecks = 0

    worker[kHealthCheckTimer] = setTimeout(async () => {
      if (worker[kWorkerStatus] !== 'started') return

      // No health data received yet — reschedule and wait.
      if (!lastHealthMetrics) {
        worker[kHealthCheckTimer].refresh()
        return
      }

      const health = lastHealthMetrics.currentHealth

      // When health collection failed (threw) or timed out, currentHealth is
      // null.  Treat this as an unhealthy check so that a stuck worker that
      // cannot even report its own health is eventually replaced.
      if (!health) {
        unhealthyChecks++

        this.logger.error(
          `Health collection failed for the ${errorLabel}. ` +
            `Unhealthy check ${unhealthyChecks}/${maxUnhealthyChecks}.`
        )

        this.emit('application:worker:health', {
          id: worker[kId],
          application: id,
          worker: index,
          currentHealth: null,
          unhealthy: true,
          healthConfig
        })

        if (unhealthyChecks === maxUnhealthyChecks) {
          try {
            this.emitAndNotify('application:worker:unhealthy', { application: id, worker: index })

            this.logger.error(
              `The ${errorLabel} is unhealthy (health collection failed). Replacing it ...`
            )

            await this.#replaceWorker(config, applicationConfig, workersCount, id, index, worker)
            this.#incrementApplicationRestartCount(id)
          } catch (e) {
            this.logger.error(
              `Cannot replace the ${errorLabel}. Forcefully terminating it ...`
            )

            worker.terminate()
          }
        } else {
          worker[kHealthCheckTimer].refresh()
        }
        return
      }

      const memoryUsage = health.heapUsed != null ? health.heapUsed / maxHeapTotal : 0
      const eventLoopDelay = maxObservedEventLoopDelay
      const eventLoopDelayP99 = maxObservedEventLoopDelayP99
      maxObservedEventLoopDelay = 0
      maxObservedEventLoopDelayP99 = 0
      const eventLoopDelayExceeded = eventLoopDelayEnabled && eventLoopDelay > maxEventLoopDelay
      const eventLoopDelayP99Exceeded = eventLoopDelayP99Enabled && eventLoopDelayP99 > maxEventLoopDelayP99
      const unhealthy =
        health.elu > maxELU || memoryUsage > maxHeapUsed || eventLoopDelayExceeded || eventLoopDelayP99Exceeded

      this.emit('application:worker:health', {
        id: worker[kId],
        application: id,
        worker: index,
        currentHealth: health,
        eventLoopDelay: eventLoopDelayMonitored ? eventLoopDelay : undefined,
        eventLoopDelayP99: eventLoopDelayMonitored ? eventLoopDelayP99 : undefined,
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

      if (eventLoopDelayExceeded) {
        this.logger.error(
          `The ${errorLabel} had a maximum event loop delay of ${eventLoopDelay.toFixed(2)} ms, ` +
            `above the maximum allowed delay of ${maxEventLoopDelay} ms.`
        )
      }

      if (eventLoopDelayP99Exceeded) {
        this.logger.error(
          `The ${errorLabel} had a p99 event loop delay of ${eventLoopDelayP99.toFixed(2)} ms, ` +
            `above the maximum allowed p99 delay of ${maxEventLoopDelayP99} ms.`
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
            {
              elu: health.elu,
              maxELU,
              memoryUsage: health.heapUsed,
              maxMemoryUsage: maxHeapUsed,
              eventLoopDelay,
              maxEventLoopDelay,
              eventLoopDelayP99,
              maxEventLoopDelayP99
            },
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
      let workerStartResult
      if (config.startTimeout > 0) {
        workerStartResult = await executeWithTimeout(sendViaITC(worker, 'start'), config.startTimeout)

        if (workerStartResult === kTimeout) {
          this.emitAndNotify('application:worker:startTimeout', eventPayload)
          this.logger.error(`The ${label} failed to start in ${config.startTimeout}ms. Forcefully killing the thread.`)
          worker.terminate()
          throw new ApplicationStartTimeoutError(id, config.startTimeout)
        }
      } else {
        workerStartResult = await sendViaITC(worker, 'start')
      }

      await this.#avoidOutOfOrderThreadLogs()

      const { url: workerUrl, scheduledTasks } = workerStartResult
      worker[kWorkerScheduledTasks] = scheduledTasks

      this.#recordWorkerUrl(worker, id, workerUrl)

      worker[kWorkerStatus] = 'started'
      worker[kWorkerStartTime] = Date.now()

      this.emitAndNotify('application:worker:started', eventPayload)
      this.#broadcastWorkers()

      if (!silent) {
        this.logger.info(`Started the ${label}...`)
      }

      const { enabled, gracePeriod } = worker[kConfig].health
      if (enabled && this.#getApplicationRestartOnError(config, applicationConfig) > 0) {
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
      let error = ensureError(err)
      worker[kITC].notify('application:worker:start:processed')

      if (error.code === 'EADDRINUSE' && Number.isInteger(Number(error.port))) {
        const port = Number(error.port)
        const owner = this.#getPortOwner(port, id)

        if (owner) {
          error = new AddressInUseError(port, owner, id)
        } else if (this.#getPortOwner(port, id, undefined, true)) {
          error = new WorkerAddressInUseError(port, id)
        }
        // Otherwise the port is used by an external process: keep the original error, which already describes it
      }
      if (error.code === 'EACCES') throw error

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

      const restartOnError = this.#getApplicationRestartOnError(config, applicationConfig)

      if (
        disableRestartAttempts ||
        !restartOnError ||
        error.code === 'EACCES' ||
        error.code === 'EADDRINUSE' ||
        error.code === 'EADDRNOTAVAIL' ||
        error.code === 'PLT_RUNTIME_EADDR_IN_USE' ||
        error.code === 'PLT_RUNTIME_WORKER_EADDR_IN_USE'
      ) {
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

      await this.#restartCrashedWorker(
        config,
        applicationConfig,
        workersCount,
        id,
        index,
        silent,
        bootstrapAttempt,
        worker[kWorkerPortOffset]
      )
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
      const res = await executeWithTimeout(sendViaITC(worker, 'stop', { force: !!this.error, dependents }), exitTimeout)

      if (res === kTimeout) {
        this.emitAndNotify('application:worker:stop:timeout', eventPayload)
        this.logger.error(`Timeout while stopping ${label}. Killing a worker thread.`)
      }
    } catch (error) {
      this.emitAndNotify('application:worker:stop:error', eventPayload)
      this.logger.error({ err: ensureLoggableError(error) }, `Failed to stop ${label}. Killing a worker thread.`)
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
      this.logger.error(`Timeout while waiting for ${label} to exit. Killing a worker thread.`)
      await worker.terminate()
    }

    await this.#avoidOutOfOrderThreadLogs()

    worker[kWorkerStatus] = 'stopped'
    worker[kWorkerUrl] = undefined
    this.emitAndNotify('application:worker:stopped', eventPayload)
    this.#broadcastWorkers()
  }

  #cleanupWorker (worker) {
    clearTimeout(worker[kHealthCheckTimer])

    const currentWorker = this.#workers.get(worker[kFullId])

    if (currentWorker === worker) {
      this.#workers.delete(worker[kFullId])
      this.#workerPortOffsets.delete(worker[kFullId])
    }

    worker[kITC].close()
  }

  async #discardWorker (worker) {
    worker.removeAllListeners('exit')
    await worker.terminate()

    // The worker might have never been registered, make sure its port offset is released
    this.#workerPortOffsets.delete(worker[kFullId])
    return this.#cleanupWorker(worker)
  }

  #workerExtendedLabel (applicationId, workerId, _workersCount) {
    return `worker ${workerId} of the application "${applicationId}"`
  }

  #getNextWorkerIndex (applicationId) {
    const index = this.#nextWorkerIndex.get(applicationId) ?? 0
    this.#nextWorkerIndex.set(applicationId, index + 1)
    return index
  }

  // Returns the lowest port offset which is not used by any worker of the application
  #getNextWorkerPortOffset (applicationId) {
    const used = new Set()

    for (const [workerId, offset] of this.#workerPortOffsets) {
      if (workerId.slice(0, workerId.lastIndexOf(':')) === applicationId) {
        used.add(offset)
      }
    }

    let offset = 0
    while (used.has(offset)) {
      offset++
    }

    return offset
  }

  // Returns true if the application of the worker is configured to listen on a fixed port shared by all its workers
  async #usesSharedFixedPort (worker) {
    let server

    try {
      server = (await sendViaITC(worker, 'getApplicationConfig'))?.server
    } catch {
      return false
    }

    if (!server || server.portAssignment === 'perWorkerIncrement') {
      return false
    }

    const port = Number(server.port)
    return Number.isInteger(port) && port > 0
  }

  // Returns the effective restartOnError value for an application: the application-level
  // value, when defined, takes precedence over the runtime-level one.
  // The value is normalized to a number: false becomes 0 (never restart),
  // true becomes the default delay.
  #getApplicationRestartOnError (config, applicationConfig) {
    let restartOnError = applicationConfig?.restartOnError ?? config.restartOnError

    if (restartOnError === true) {
      restartOnError = DEFAULT_RESTART_ON_ERROR_DELAY
    } else if (restartOnError === false || restartOnError < 0) {
      restartOnError = 0
    }

    return restartOnError
  }

  async #restartCrashedWorker (
    config,
    applicationConfig,
    workersCount,
    id,
    oldIndex,
    silent,
    bootstrapAttempt,
    portOffset
  ) {
    const restartOnError = this.#getApplicationRestartOnError(config, applicationConfig)

    // Use oldIndex for tracking to prevent duplicate restarts of the same crashed worker
    const restartKey = `${id}:${oldIndex}`

    let restartPromise = this.#restartingWorkers.get(restartKey)
    if (restartPromise) {
      await restartPromise
      return
    }

    restartPromise = new Promise((resolve, reject) => {
      async function restart () {
        this.#restartingWorkers.delete(restartKey)

        // If some processes were scheduled to restart
        // but the runtime is stopped, ignore it
        if (!this.#status.startsWith('start')) {
          resolve()
          return
        }

        // Get a new unique index for the restarted worker, which inherits the port offset of the crashed one
        const newIndex = this.#getNextWorkerIndex(id)
        const newWorkerId = `${id}:${newIndex}`
        this.#workerPortOffsets.set(newWorkerId, portOffset ?? oldIndex)

        try {
          await this.#setupWorker(config, applicationConfig, workersCount, id, newIndex)
          await this.#startWorker(
            config,
            applicationConfig,
            workersCount,
            id,
            newIndex,
            silent,
            bootstrapAttempt
          )
          this.#incrementApplicationRestartCount(id)

          this.logger.info(
            `The ${this.#workerExtendedLabel(id, newIndex, workersCount)} has been successfully restarted ...`
          )
          resolve()
        } catch (err) {
          this.#workerPortOffsets.delete(newWorkerId)

          // The runtime was stopped while the restart was happening, ignore any error.
          if (!this.#status.startsWith('start')) {
            resolve()
            return
          }

          reject(err)
        }
      }

      if (restartOnError < IMMEDIATE_RESTART_MAX_THRESHOLD) {
        process.nextTick(restart.bind(this))
      } else {
        setTimeout(restart.bind(this), restartOnError)
      }
    })

    this.#restartingWorkers.set(restartKey, restartPromise)
    await restartPromise
  }

  async #replaceWorker (
    config,
    applicationConfig,
    workersCount,
    applicationId,
    oldIndex,
    worker,
    silent,
    deferOldWorkerRetirement = false
  ) {
    const oldLabel = this.#workerExtendedLabel(applicationId, oldIndex, workersCount)
    let newWorker

    // Get a new unique index for the replacement worker, which inherits the port offset of the replaced one
    const newIndex = this.#getNextWorkerIndex(applicationId)
    const newWorkerId = `${applicationId}:${newIndex}`
    const newLabel = this.#workerExtendedLabel(applicationId, newIndex, workersCount)
    this.#workerPortOffsets.set(newWorkerId, worker[kWorkerPortOffset] ?? oldIndex)

    const stopBeforeStart =
      Boolean(worker[kWorkerUrl]) &&
      worker[kWorkerServerOptions]?.port !== 0 &&
      (config.reuseTcpPorts === false || applicationConfig.reuseTcpPorts === false || !features.node.reusePort)

    try {
      if (!silent) {
        this.logger.debug(`Preparing to start ${newLabel} as replacement for ${oldLabel} ...`)
      }

      if (stopBeforeStart) {
        await this.#removeWorker(workersCount, applicationId, oldIndex, worker, silent, oldLabel)
      }

      newWorker = await this.#setupWorker(
        config,
        applicationConfig,
        workersCount,
        applicationId,
        newIndex,
        false
      )

      // Make sure the runtime hasn't been stopped in the meanwhile
      if (this.#status !== 'started') {
        return this.#discardWorker(newWorker)
      }

      // Register the worker before starting it, like in the regular startup flow,
      // so that it is addressable when the application:worker:started event is emitted.
      // The discard paths below remove it from the map via #cleanupWorker.
      this.#workers.set(newWorkerId, newWorker)

      // Add the worker to the mesh
      await this.#startWorker(
        config,
        applicationConfig,
        workersCount,
        applicationId,
        newIndex,
        false,
        0,
        newWorker,
        true
      )

      // Make sure the runtime hasn't been stopped in the meanwhile
      if (this.#status !== 'started') {
        return this.#discardWorker(newWorker)
      }
    } catch (e) {
      if (this.#workers.get(newWorkerId) === newWorker) {
        this.#workers.delete(newWorkerId)
      }

      this.#workerPortOffsets.delete(newWorkerId)
      newWorker?.terminate?.()
      throw e
    }

    if (!stopBeforeStart) {
      if (deferOldWorkerRetirement) {
        return {
          discard: () => this.#discardWorker(newWorker),
          retire: () => this.#removeWorker(workersCount, applicationId, oldIndex, worker, silent, oldLabel)
        }
      }

      await this.#removeWorker(workersCount, applicationId, oldIndex, worker, silent, oldLabel)
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

  // Profiling start and stop must address the same worker: resolve an id
  // without an explicit worker index to the first worker deterministically,
  // as the round-robin used by #getApplicationById would rotate to a
  // different worker between the two calls.
  async #getApplicationWorkerForProfiling (applicationId, ensureStarted) {
    if (hasWorkerIndex(applicationId)) {
      return this.#getApplicationById(applicationId, ensureStarted)
    }

    if (!this.#applications.has(applicationId)) {
      throw new ApplicationNotFoundError(applicationId, this.getApplicationsIds().join(', '))
    }

    const [firstWorker] = this.#workers.getKeys(applicationId)
    return this.#getWorkerByIdOrNext(applicationId, firstWorker?.split(':')[1], ensureStarted)
  }

  async #getApplicationWorkersForProfiling (applicationId, ensureStarted) {
    if (!this.#applications.has(applicationId)) {
      throw new ApplicationNotFoundError(applicationId, this.getApplicationsIds().join(', '))
    }

    const workers = []
    for (const key of this.#workers.getKeys(applicationId)) {
      const workerIndex = parseInt(key.split(':')[1], 10)
      workers.push({ workerIndex, worker: await this.#getWorkerByIdOrNext(applicationId, workerIndex, ensureStarted) })
    }

    return workers
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

    if (this.#config.applications.length === 0) {
      this.#workersBroadcastChannel = undefined
      return
    }

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
    const packageJsonPath = join(this.#root, 'package.json')

    /*
      A project need not have one, and a runtime that cannot report its metadata without one is a
      runtime whose `applications:add --save` stops working -- that command reads `projectDir`,
      `configPath` and `autoload` from this, and has done since `GET /config` was removed. The
      metadata already declares `packageName` and `packageVersion` as nullable, so absence is a
      state its shape allows.
    */
    try {
      return JSON.parse(await readFile(packageJsonPath, 'utf8'))
    } catch {
      return {}
    }
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
      let pinoLevel

      if (message !== null && typeof message === 'object') {
        pinoLevel = message[this.#pinoLevelKey]

        pinoLog =
          (typeof pinoLevel === 'number' || (this.#pinoCustomizedKeys && typeof pinoLevel === 'string')) &&
          // We want to accept both pino raw time (number) and time as formatted string
          (typeof message[this.#pinoTimeKey] === 'number' || typeof message[this.#pinoTimeKey] === 'string') &&
          typeof message[this.#pinoMessageKey] === 'string'
      }

      // Directly write to the Pino destination
      if (pinoLog) {
        if (!this.#loggerDestination) {
          continue
        }

        if (typeof pinoLevel === 'string') {
          pinoLevel =
            logger.levels.values[pinoLevel] ?? logger.levels.values[pinoLevel.toLowerCase()] ?? logger.levels.values[level]
        }

        this.#loggerDestination.lastLevel = pinoLevel
        this.#loggerDestination.lastTime = message[this.#pinoTimeKey]
        this.#loggerDestination.lastMsg = message[this.#pinoMessageKey]
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

      // Get actual worker keys to iterate over existing workers (snapshot to avoid mutation during iteration)
      const workerKeys = [...this.#workers.getKeys(applicationId)]
      for (const workerKey of workerKeys) {
        const workerIndex = parseInt(workerKey.split(':')[1], 10)
        this.logger.info(
          { health: { current: currentHealth, new: health } },
          `Restarting application "${applicationId}" worker ${workerIndex} to update config health heap...`
        )

        const worker = this.#workers.get(workerKey)
        if (health.maxHeapTotal) {
          worker[kConfig].health.maxHeapTotal = health.maxHeapTotal
        }
        if (health.maxYoungGeneration) {
          worker[kConfig].health.maxYoungGeneration = health.maxYoungGeneration
        }

        await this.#replaceWorker(config, applicationConfig, currentWorkers, applicationId, workerIndex, worker)
        report.updated.push(workerIndex)
        this.logger.info(
          { health: { current: currentHealth, new: health } },
          `Restarted application "${applicationId}" worker ${workerIndex}`
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

      let pendingWorkerId

      try {
        for (let i = currentWorkers; i < workers; i++) {
          const newIndex = this.#getNextWorkerIndex(applicationId)
          pendingWorkerId = `${applicationId}:${newIndex}`
          this.#workerPortOffsets.set(pendingWorkerId, this.#getNextWorkerPortOffset(applicationId))

          await this.#setupWorker(config, applicationConfig, workers, applicationId, newIndex)
          await this.#startWorker(config, applicationConfig, workers, applicationId, newIndex, false, 0)

          pendingWorkerId = undefined
          report.started.push(newIndex)
          startedWorkersCount++
        }

        // A worker added after boot re-runs the application's code, so it can answer differently
        // from the workers already running. Scale-up is the second place the answers must agree.
        await this.#collectServingState(applicationId)
        report.success = true
      } catch (err) {
        if (pendingWorkerId) {
          this.#workerPortOffsets.delete(pendingWorkerId)
        }

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
        const workersToStop = currentWorkers - workers
        // Stop the workers with the highest port offsets (which are the most recent workers, unless some of them
        // were replaced) first, so that applications using server.portAssignment=perWorkerIncrement keep listening
        // on a contiguous range of ports starting from the configured one.
        const workerIdsToStop = this.#workers
          .getKeys(applicationId)
          .map(key => parseInt(key.split(':')[1], 10))
          .sort((a, b) => {
            const offsetA = this.#workerPortOffsets.get(`${applicationId}:${a}`) ?? a
            const offsetB = this.#workerPortOffsets.get(`${applicationId}:${b}`) ?? b

            return offsetB - offsetA || b - a
          })

        for (const workerIndex of workerIdsToStop.splice(0, workersToStop)) {
          const worker = this.#workers.get(`${applicationId}:${workerIndex}`)
          await sendViaITC(worker, 'removeFromMesh')
          await this.#stopWorker(currentWorkers, applicationId, workerIndex, false, worker, [])
          report.stopped.push(workerIndex)
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

    // Starting from Node.js 25 the Permission Model also gates network access
    // (dns.lookup, server.listen, outbound connections and fetch) behind
    // --allow-net. Applications always need to bind their HTTP server and reach
    // other applications through the internal mesh, so we always grant it when
    // available. On older versions the flag does not exist and must be omitted.
    if (features.node.permission.network) {
      allows.add('--allow-net')
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

  async #loadExtensions () {
    let extensions = this.#config.extensions

    if (!extensions) {
      return
    }

    if (!Array.isArray(extensions)) {
      extensions = [extensions]
    }

    for (const extension of extensions) {
      const { path, options, build } = typeof extension === 'string' ? { path: extension } : extension

      // Runtime extensions historically were not loaded by `wattpm build`.
      // Preserve that behavior unless an extension explicitly opts into the
      // build lifecycle.
      if (this.#context.build && !build) {
        continue
      }

      let imported
      try {
        imported = await import(pathToFileURL(path))
      } catch (e) {
        throw new FailedToLoadExtensionError(path, e.message, { cause: e })
      }

      const setup = resolveExtensionSetup(imported)

      if (typeof setup !== 'function') {
        throw new InvalidExtensionError(path)
      }

      const logger = this.logger.child({ name: `extension:${basename(path)}` })
      const health = this.#createExtensionHealth(path, logger)

      // One registry per extension so metric conflicts and cleanup are isolated.
      // Extension metrics are main-thread only: Runtime never invents a worker ID.
      const registry = new metricsClient.Registry()
      const metrics = { client: metricsClient, registry }

      try {
        const instance = await setup({
          runtime: this,
          itc: this.#createExtensionITC(),
          sharedContext: this.#createExtensionSharedContext(),
          logger,
          options: options ?? {},
          root: this.#root,
          metrics,
          health
        })

        this.#extensions.push({ path, instance, registry, health, started: false, stopped: false, closed: false })
      } catch (e) {
        registry.clear()
        // Drop any health contributions from a failed extension setup.
        health.cleanup()
        throw new FailedToLoadExtensionError(path, e.message, { cause: e })
      }
    }

    // If any extension subscribed to health metrics during its setup, make sure
    // the health metrics collection is started even if no health check or
    // dynamic workers scaler is enabled. Note that this is evaluated here on
    // purpose, before any worker health check listener is registered.
    this.#extensionsWantHealthMetrics = this.listenerCount('application:worker:health:metrics') > 0
  }

  #isApplicationStarted (id) {
    const applicationConfig = this.#applications.get(id)
    if (!applicationConfig) {
      return false
    }

    const workers = applicationConfig.workers.static
    for (let i = 0; i < workers; i++) {
      const worker = this.#workers.get(`${id}:${i}`)
      const status = worker?.[kWorkerStatus]

      // Match startApplication(): anything past boot/init means already started.
      if (status && status !== 'boot' && status !== 'init') {
        return true
      }
    }

    return false
  }

  async #startExtensions () {
    for (const extension of this.#extensions) {
      if (extension.started) {
        continue
      }

      try {
        await extension.instance?.start?.()
        extension.started = true
      } catch (e) {
        throw new FailedToStartExtensionError(extension.path, e.message, { cause: e })
      }
    }
  }

  async #stopExtensions () {
    // Stop in reverse order, so that extensions loaded later, which might depend
    // on earlier ones, are stopped first. Only extensions that completed start
    // (including those without a start hook) are stopped, and at most once.
    for (const extension of [...this.#extensions].reverse()) {
      if (!extension.started || extension.stopped) {
        continue
      }

      // Mark before invoking so repeated stop is idempotent even if stop throws.
      extension.stopped = true

      try {
        await extension.instance?.stop?.()
      } catch (e) {
        const err = new FailedToStopExtensionError(extension.path, e.message, { cause: e })
        this.logger.error({ err: ensureLoggableError(err) }, `Failed to stop the extension "${extension.path}".`)
      }
    }
  }

  async #closeExtensions () {
    // Close in reverse order, so that extensions loaded later, which might depend
    // on earlier ones, are closed first. Close is invoked at most once per extension.
    const extensions = this.#extensions.splice(0).reverse()

    for (const extension of extensions) {
      if (extension.closed) {
        continue
      }

      extension.closed = true

      try {
        await extension.instance?.close?.()
      } catch (e) {
        this.logger.error(
          { err: ensureLoggableError(e) },
          `Failed to close the extension "${extension.path}".`
        )
      } finally {
        // Always drop health contributions with the extension, even if close fails.
        extension.health?.cleanup?.()
      }

      // Drop the extension registry after close so its metrics stop appearing in
      // getMetrics()/exporters and collectors cannot keep running in the background.
      try {
        extension.registry?.clear()
      } catch (e) {
        this.logger.error(
          { err: ensureLoggableError(e) },
          `Failed to clear metrics registry for extension "${extension.path}".`
        )
      }
    }
  }

  #createExtensionSharedContext () {
    return {
      // Synchronous on the main thread. Return an isolated snapshot so an
      // extension cannot mutate the store without going through update(),
      // which broadcasts changes to workers.
      get: () => structuredClone(this.getSharedContext()),
      update: async (update, options = {}) => {
        // Keep the positional update authoritative, matching the worker API.
        await this.updateSharedContext({ ...options, context: update })
      }
    }
  }

  #getHealthChecksTimeout () {
    const metrics = this.#config.metrics
    if (typeof metrics !== 'object' || metrics === null) {
      return 5000
    }

    // Prefer the schema property; keep the historical misspelled key as a fallback.
    return metrics.healthChecksTimeouts ?? metrics.healthChecksTimeout ?? 5000
  }

  #assertExtensionHealthRoutesApplied () {
    const pending = this.#extensionHealthRoutes.filter(entry => entry.active && !entry.applied)
    if (pending.length > 0) {
      throw new ExtensionHealthRoutesUnavailableError()
    }
  }

  async #runExtensionHealthChecks (checks, kind) {
    if (checks.size === 0) {
      return { status: true }
    }

    const timeout = this.#getHealthChecksTimeout()
    let response

    for (const [name, entry] of checks) {
      const result = await this.#runExtensionHealthCheck(name, entry, kind, timeout)

      if (typeof result === 'object' && result !== null) {
        response = result
      }

      if (!this.#isExtensionHealthCheckSuccessful(result)) {
        this.logger.error(
          { extension: entry.extensionPath, check: name, kind },
          `Extension ${kind} check "${name}" failed.`
        )
        return { status: false, response }
      }
    }

    return { status: true, response }
  }

  async #runExtensionHealthCheck (name, entry, kind, timeout) {
    try {
      const result = await executeWithTimeout(
        Promise.resolve().then(() => entry.check()),
        timeout,
        kTimeout
      )

      if (result === kTimeout) {
        this.logger.error(
          { extension: entry.extensionPath, check: name, kind, timeout },
          `Extension ${kind} check "${name}" timed out.`
        )
        return false
      }

      if (typeof result === 'boolean') {
        return result
      }

      if (typeof result === 'object' && result !== null && typeof result.status === 'boolean') {
        return result
      }

      this.logger.error(
        { extension: entry.extensionPath, check: name, kind, result },
        `Extension ${kind} check "${name}" returned a malformed result.`
      )
      return false
    } catch (err) {
      this.logger.error(
        { err: ensureLoggableError(err), extension: entry.extensionPath, check: name, kind },
        `Extension ${kind} check "${name}" rejected.`
      )
      return false
    }
  }

  #isExtensionHealthCheckSuccessful (result) {
    if (typeof result === 'boolean') {
      return result
    }

    if (typeof result === 'object' && result !== null) {
      return !!result.status
    }

    return false
  }

  #createExtensionHealth (extensionPath, logger) {
    const readinessNames = new Set()
    const livenessNames = new Set()
    const routeEntries = []

    const registerCheck = (map, names, kind, name, check) => {
      if (typeof name !== 'string' || name.length === 0) {
        throw new InvalidArgumentError(`${kind} check name must be a non-empty string`)
      }

      if (typeof check !== 'function') {
        throw new InvalidArgumentError(`${kind} check "${name}" must be a function`)
      }

      const existing = map.get(name)
      if (existing) {
        throw new DuplicateExtensionHealthCheckError(kind, name, existing.extensionPath)
      }

      const entry = { extensionPath, check }
      map.set(name, entry)
      names.add(name)

      logger.debug({ check: name, kind }, `Registered extension ${kind} check "${name}"`)

      return () => {
        const current = map.get(name)
        if (current === entry) {
          map.delete(name)
        }
        names.delete(name)
      }
    }

    const api = {
      registerReadinessCheck: (name, check) => {
        return registerCheck(this.#extensionReadinessChecks, readinessNames, 'readiness', name, check)
      },
      registerLivenessCheck: (name, check) => {
        return registerCheck(this.#extensionLivenessChecks, livenessNames, 'liveness', name, check)
      },
      registerRoutes: plugin => {
        if (typeof plugin !== 'function') {
          throw new InvalidArgumentError('health route plugin must be a function')
        }

        const entry = {
          extensionPath,
          plugin,
          active: true,
          applied: false
        }

        this.#extensionHealthRoutes.push(entry)
        routeEntries.push(entry)

        logger.debug('Registered extension health routes plugin')

        return () => {
          entry.active = false
          const index = this.#extensionHealthRoutes.indexOf(entry)
          if (index !== -1) {
            this.#extensionHealthRoutes.splice(index, 1)
          }
        }
      },
      cleanup: () => {
        for (const name of readinessNames) {
          const current = this.#extensionReadinessChecks.get(name)
          if (current?.extensionPath === extensionPath) {
            this.#extensionReadinessChecks.delete(name)
          }
        }
        readinessNames.clear()

        for (const name of livenessNames) {
          const current = this.#extensionLivenessChecks.get(name)
          if (current?.extensionPath === extensionPath) {
            this.#extensionLivenessChecks.delete(name)
          }
        }
        livenessNames.clear()

        for (const entry of routeEntries) {
          entry.active = false
          const index = this.#extensionHealthRoutes.indexOf(entry)
          if (index !== -1) {
            this.#extensionHealthRoutes.splice(index, 1)
          }
        }
        routeEntries.length = 0
      }
    }

    return api
  }

  #createExtensionITC () {
    return {
      handle: (name, handler) => {
        if (this.#reservedITCHandlerNames.has(name)) {
          throw new ReservedITCHandlerNameError(name)
        }

        if (name in this.#workerITCHandlers) {
          throw new DuplicateITCHandlerNameError(name)
        }

        this.#workerITCHandlers[name] = handler

        // Workers copy the handlers when their ITC is created, so also register
        // the handler on all running workers.
        for (const worker of this.#workers.values()) {
          worker[kITC]?.handle(name, handler)
        }
      },
      send: async (target, name, payload) => {
        const worker = await this.#getApplicationById(target)
        return sendViaITC(worker, name, payload)
      },
      notify: async (target, name, payload) => {
        const matched = target.match(/^(.+):(\d+)$/)

        if (matched) {
          const worker = await this.#getWorkerByIdOrNext(matched[1], matched[2])
          worker[kITC].notify(name, payload)
          return
        }

        if (!this.#applications.has(target)) {
          throw new ApplicationNotFoundError(target, this.getApplicationsIds().join(', '))
        }

        for (const worker of this.#workers.values()) {
          if (worker[kApplicationId] === target && worker[kWorkerStatus] === 'started') {
            worker[kITC].notify(name, payload)
          }
        }
      }
    }
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

  #getPortOwner (port, applicationId, hostname, includeSameApplication = false) {
    if (!Number.isInteger(port) || port <= 0) {
      return null
    }

    for (const worker of this.#workers.values()) {
      if (!worker[kWorkerUrl] || (!includeSameApplication && worker[kApplicationId] === applicationId)) {
        continue
      }

      try {
        const url = new URL(worker[kWorkerUrl])
        const workerPort = Number(url.port || (url.protocol === 'https:' ? 443 : 80))
        const workerHost = url.hostname
        if (workerPort === port && this.#listenersOverlap(hostname ?? workerHost, workerHost)) {
          return worker[kApplicationId]
        }
      } catch {}
    }

    return null
  }

  #listenersOverlap (host, otherHost) {
    host = host.toLowerCase()
    const wildcards = new Set(['0.0.0.0', '::', '[::]'])
    otherHost = otherHost.toLowerCase()
    return host === otherHost || wildcards.has(host) || wildcards.has(otherHost)
  }

  #recordWorkerUrl (worker, applicationId, workerUrl) {
    if (!workerUrl) {
      worker[kWorkerUrl] = undefined
      return
    }

    let hostname
    let port
    try {
      const url = new URL(workerUrl)
      hostname = url.hostname
      port = Number(url.port || (url.protocol === 'https:' ? 443 : 80))
    } catch {}

    const owner = this.#getPortOwner(port, applicationId, hostname)
    if (owner) {
      throw new AddressInUseError(port, owner, applicationId)
    }

    worker[kWorkerUrl] = workerUrl
  }
}
