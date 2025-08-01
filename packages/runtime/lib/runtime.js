'use strict'

const { ITC } = require('@platformatic/itc')
const { features, ensureLoggableError, executeWithTimeout, deepmerge, parseMemorySize, kTimeout } = require('@platformatic/utils')
const { once, EventEmitter } = require('node:events')
const { createReadStream, watch, existsSync } = require('node:fs')
const { readdir, readFile, stat, access } = require('node:fs/promises')
const { STATUS_CODES } = require('node:http')
const { join } = require('node:path')
const { setTimeout: sleep, setImmediate: immediate } = require('node:timers/promises')
const { Worker } = require('node:worker_threads')
const ts = require('tail-file-stream')
const { Agent, interceptors: undiciInterceptors, request } = require('undici')
const { createThreadInterceptor } = require('undici-thread-interceptor')
const SonicBoom = require('sonic-boom')

const { checkDependencies, topologicalSort } = require('./dependencies')
const errors = require('./errors')
const { createLogger } = require('./logger')
const { startManagementApi } = require('./management-api')
const { startPrometheusServer } = require('./prom-server')
const { startScheduler } = require('./scheduler')
const { createSharedStore } = require('./shared-http-cache')
const { getRuntimeTmpDir } = require('./utils')
const { sendViaITC, waitEventFromITC } = require('./worker/itc')
const { RoundRobinMap } = require('./worker/round-robin-map.js')
const {
  kId,
  kFullId,
  kServiceId,
  kWorkerId,
  kITC,
  kHealthCheckTimer,
  kConfig,
  kWorkerStatus,
  kStderrMarker,
  kLastELU,
  kWorkersBroadcast
} = require('./worker/symbols')

const fastify = require('fastify')

const platformaticVersion = require('../package.json').version
const kWorkerFile = join(__dirname, 'worker/main.js')

const kInspectorOptions = Symbol('plt.runtime.worker.inspectorOptions')
const kForwardEvents = Symbol('plt.runtime.worker.forwardEvents')

const MAX_LISTENERS_COUNT = 100
const MAX_METRICS_QUEUE_LENGTH = 5 * 60 // 5 minutes in seconds
const COLLECT_METRICS_TIMEOUT = 1000

const MAX_BOOTSTRAP_ATTEMPTS = 5
const IMMEDIATE_RESTART_MAX_THRESHOLD = 10
const MAX_WORKERS = 100

const telemetryPath = require.resolve('@platformatic/telemetry')
const openTelemetrySetupPath = join(telemetryPath, '..', 'lib', 'node-telemetry.js')

class Runtime extends EventEmitter {
  #configManager
  #isProduction
  #runtimeTmpDir
  #runtimeLogsDir
  #env
  #servicesIds
  #entrypointId
  #url
  #loggerDestination
  #metrics
  #metricsTimeout
  #status // starting, started, stopping, stopped, closed
  #meshInterceptor
  #dispatcher
  #managementApi
  #prometheusServer
  #inspectorServer
  #workers
  #workersBroadcastChannel
  #workerITCHandlers
  #restartingWorkers
  #sharedHttpCache
  servicesConfigsPatches
  #scheduler
  #stdio
  #sharedContext

  constructor (configManager, runtimeLogsDir, env) {
    super()
    this.setMaxListeners(MAX_LISTENERS_COUNT)

    this.#configManager = configManager
    this.#runtimeTmpDir = getRuntimeTmpDir(configManager.dirname)
    this.#runtimeLogsDir = runtimeLogsDir
    this.#env = env
    this.#workers = new RoundRobinMap()
    this.#servicesIds = []
    this.#url = undefined
    this.#meshInterceptor = createThreadInterceptor({
      domain: '.plt.local',
      timeout: this.#configManager.current.serviceTimeout
    })
    this.#status = undefined
    this.#restartingWorkers = new Map()
    this.#sharedHttpCache = null
    this.servicesConfigsPatches = new Map()

    if (!this.#configManager.current.logger.captureStdio) {
      this.#stdio = {
        stdout: new SonicBoom({ fd: process.stdout.fd }),
        stderr: new SonicBoom({ fd: process.stderr.fd })
      }
    }

    this.#workerITCHandlers = {
      getServiceMeta: this.getServiceMeta.bind(this),
      listServices: () => this.#servicesIds,
      getServices: this.getServices.bind(this),
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
    const config = this.#configManager.current
    const autoloadEnabled = config.autoload

    // This cannot be transferred to worker threads
    delete config.configManager

    if (config.managementApi) {
      this.#managementApi = await startManagementApi(this, this.#configManager)
    }

    if (config.metrics) {
      this.#prometheusServer = await startPrometheusServer(this, config.metrics)
    }

    // Create the logger
    const [logger, destination] = await createLogger(config, this.#runtimeLogsDir)
    this.logger = logger
    this.#loggerDestination = destination

    this.#isProduction = this.#configManager.args?.production ?? false
    this.#servicesIds = config.services.map(service => service.id)
    this.#createWorkersBroadcastChannel()

    const workersConfig = []
    for (const service of config.services) {
      const count = service.workers ?? this.#configManager.current.workers
      if (count > 1 && service.entrypoint && !features.node.reusePort) {
        this.logger.warn(
          `"${service.id}" is set as the entrypoint, but reusePort is not available in your OS; setting workers to 1 instead of ${count}`
        )
        workersConfig.push({ id: service.id, workers: 1 })
      } else {
        workersConfig.push({ id: service.id, workers: count })
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

    // Create all services, each in is own worker thread
    for (const serviceConfig of config.services) {
      // If there is no service path, check if the service was resolved
      if (!serviceConfig.path) {
        if (serviceConfig.url) {
          // Try to backfill the path for external services
          serviceConfig.path = join(this.#configManager.dirname, config.resolvedServicesBasePath, serviceConfig.id)

          if (!existsSync(serviceConfig.path)) {
            const executable = globalThis.platformatic?.executable ?? 'platformatic'
            this.logger.error(
              `The path for service "%s" does not exist. Please run "${executable} resolve" and try again.`,
              serviceConfig.id
            )

            await this.closeAndThrow(new errors.RuntimeAbortedError())
          }
        } else {
          this.logger.error(
            'The service "%s" has no path defined. Please check your configuration and try again.',
            serviceConfig.id
          )

          await this.closeAndThrow(new errors.RuntimeAbortedError())
        }
      }

      await this.#setupService(serviceConfig)
    }

    try {
      checkDependencies(config.services)

      // Make sure the list exists before computing the dependencies, otherwise some services might not be stopped
      if (autoloadEnabled) {
        this.#workers = topologicalSort(this.#workers, config)
      }

      // Recompute the list of services after sorting
      this.#servicesIds = config.services.map(service => service.id)

      // When autoloading is disabled, add a warning if a service is defined before its dependencies
      if (!autoloadEnabled) {
        for (let i = 0; i < config.services.length; i++) {
          const current = config.services[i]

          for (const dep of current.dependencies ?? []) {
            if (config.services.findIndex(s => s.id === dep.id) > i) {
              this.logger.warn(
                `Service "${current.id}" depends on service "${dep.id}", but it is defined and it will be started before it. Please check your configuration file.`
              )
            }
          }
        }
      }
    } catch (e) {
      await this.closeAndThrow(e)
    }

    await this.#setDispatcher(config.undici)

    if (config.scheduler) {
      this.#scheduler = startScheduler(config.scheduler, this.#dispatcher, logger)
    }

    this.#updateStatus('init')
  }

  async start (silent = false) {
    if (typeof this.#configManager.current.entrypoint === 'undefined') {
      throw new errors.MissingEntrypointError()
    }
    this.#updateStatus('starting')
    this.#createWorkersBroadcastChannel()

    // Important: do not use Promise.all here since it won't properly manage dependencies
    try {
      for (const service of this.#servicesIds) {
        await this.startService(service, silent)
      }

      if (this.#configManager.current.inspectorOptions) {
        const { port } = this.#configManager.current.inspectorOptions

        const server = fastify({
          loggerInstance: this.logger.child({ name: 'inspector' }, { level: 'warn' })
        })

        const version = await fetch(
          `http://127.0.0.1:${this.#configManager.current.inspectorOptions.port + 1}/json/version`
        ).then(res => res.json())

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
          'The inspector server is now listening for all services. Open `chrome://inspect` in Google Chrome to connect.'
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
      await this.stopService(this.#entrypointId, silent)
    }

    // Stop services in reverse order to ensure services which depend on others are stopped first
    for (const service of this.#servicesIds.reverse()) {
      // The entrypoint has been stopped above
      if (service === this.#entrypointId) {
        continue
      }

      await this.stopService(service, silent)
    }

    await this.#meshInterceptor.close()
    this.#workersBroadcastChannel?.close()

    this.#updateStatus('stopped')
  }

  async restart () {
    this.emit('restarting')

    await this.stop()
    this.#meshInterceptor.restart()
    await this.start()

    this.emit('restarted')

    return this.#url
  }

  getRuntimeStatus () {
    return this.#status
  }

  async close (silent = false) {
    this.#updateStatus('closing')

    clearInterval(this.#metricsTimeout)

    await this.stop(silent)

    if (this.#managementApi) {
      // This allow a close request coming from the management API to correctly be handled
      setImmediate(() => {
        this.#managementApi.close()
      })
    }

    if (this.#prometheusServer) {
      await this.#prometheusServer.close()
    }

    if (this.logger) {
      this.#loggerDestination.end()

      this.logger = null
      this.#loggerDestination = null
    }

    if (this.#sharedHttpCache?.close) {
      await this.#sharedHttpCache.close()
    }

    this.#updateStatus('closed')
  }

  async closeAndThrow (error) {
    this.#updateStatus('errored', error)

    // Wait for the next tick so that any pending logging is properly flushed
    await sleep(1)
    await this.close()

    throw error
  }

  async startService (id, silent = false) {
    // Since when a service is stopped the worker is deleted, we consider a service start if its first service
    // is no longer in the init phase
    const firstWorker = this.#workers.get(`${id}:0`)
    if (firstWorker && firstWorker[kWorkerStatus] !== 'boot' && firstWorker[kWorkerStatus] !== 'init') {
      throw new errors.ApplicationAlreadyStartedError()
    }

    const config = this.#configManager.current
    const serviceConfig = config.services.find(s => s.id === id)

    if (!serviceConfig) {
      throw new errors.ServiceNotFoundError(id, Array.from(this.#servicesIds).join(', '))
    }

    const workersCount = await this.#workers.getCount(serviceConfig.id)

    this.emit('service:starting', id)

    for (let i = 0; i < workersCount; i++) {
      await this.#startWorker(config, serviceConfig, workersCount, id, i, silent)
    }

    this.emit('service:started', id)
  }

  async stopService (id, silent = false) {
    const config = this.#configManager.current
    const serviceConfig = config.services.find(s => s.id === id)

    if (!serviceConfig) {
      throw new errors.ServiceNotFoundError(id, Array.from(this.#servicesIds).join(', '))
    }

    const workersCount = await this.#workers.getCount(serviceConfig.id)

    this.emit('service:stopping', id)

    for (let i = 0; i < workersCount; i++) {
      await this.#stopWorker(workersCount, id, i, silent)
    }

    this.emit('service:stopped', id)
  }

  async buildService (id) {
    const service = await this.#getServiceById(id)

    this.emit('service:building', id)
    try {
      await sendViaITC(service, 'build')
      this.emit('service:built', id)
    } catch (e) {
      // The service exports no meta, return an empty object
      if (e.code === 'PLT_ITC_HANDLER_NOT_FOUND') {
        return {}
      }

      throw e
    }
  }

  async inject (id, injectParams) {
    // Make sure the service exists
    await this.#getServiceById(id, true)

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

  async updateUndiciInterceptors (undiciConfig) {
    this.#configManager.current.undici = undiciConfig

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
        if (!(error instanceof errors.RuntimeExitedError)) {
          // TODO(mcollina): use the logger
          console.error('Error collecting metrics', error)
        }
        return
      }

      this.emit('metrics', metrics)
      this.#metrics.push(metrics)
      if (this.#metrics.length > MAX_METRICS_QUEUE_LENGTH) {
        this.#metrics.shift()
      }
    }, COLLECT_METRICS_TIMEOUT).unref()
  }

  async pipeLogsStream (writableStream, logger, startLogId, endLogId, runtimePID) {
    endLogId = endLogId || Infinity
    runtimePID = runtimePID ?? process.pid

    const runtimeLogFiles = await this.#getRuntimeLogFiles(runtimePID)

    if (runtimeLogFiles.length === 0) {
      writableStream.end()
      return
    }

    let latestFileId = parseInt(runtimeLogFiles.at(-1).slice('logs.'.length))

    let fileStream = null
    let fileId = startLogId ?? latestFileId
    let isClosed = false

    const runtimeLogsDir = this.#getRuntimeLogsDir(runtimePID)

    const watcher = watch(runtimeLogsDir, async (event, filename) => {
      if (event === 'rename' && filename.startsWith('logs')) {
        const logFileId = parseInt(filename.slice('logs.'.length))
        if (logFileId > latestFileId) {
          latestFileId = logFileId
          fileStream.unwatch()
        }
      }
    }).unref()

    const streamLogFile = () => {
      if (fileId > endLogId) {
        writableStream.end()
        return
      }

      const fileName = 'logs.' + fileId
      const filePath = join(runtimeLogsDir, fileName)

      const prevFileStream = fileStream

      fileStream = ts.createReadStream(filePath)
      fileStream.pipe(writableStream, { end: false, persistent: false })

      if (prevFileStream) {
        prevFileStream.unpipe(writableStream)
        prevFileStream.destroy()
      }

      fileStream.on('close', () => {
        if (latestFileId > fileId && !isClosed) {
          streamLogFile(++fileId)
        }
      })

      fileStream.on('error', err => {
        isClosed = true
        logger.error(err, 'Error streaming log file')
        fileStream.destroy()
        watcher.close()
        writableStream.end()
      })

      fileStream.on('eof', () => {
        if (fileId >= endLogId) {
          writableStream.end()
          return
        }
        if (latestFileId > fileId) {
          fileStream.unwatch()
        }
      })

      return fileStream
    }

    streamLogFile(fileId)

    const onClose = () => {
      isClosed = true
      watcher.close()
      fileStream.destroy()
    }

    writableStream.on('close', onClose)
    writableStream.on('error', onClose)
    this.on('closed', onClose)
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
      projectDir: this.#configManager.dirname,
      packageName: packageJson.name ?? null,
      packageVersion: packageJson.version ?? null,
      url: entrypointDetails?.url ?? null,
      platformaticVersion
    }
  }

  getRuntimeEnv () {
    return this.#configManager.env
  }

  getRuntimeConfig () {
    return this.#configManager.current
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
    return this.#managementApi?.server.address()
  }

  async getEntrypointDetails () {
    return this.getServiceDetails(this.#entrypointId)
  }

  async getServices () {
    return {
      entrypoint: this.#entrypointId,
      production: this.#isProduction,
      services: await Promise.all(this.#servicesIds.map(id => this.getServiceDetails(id)))
    }
  }

  async getWorkers () {
    const status = {}

    for (const [service, { count }] of Object.entries(this.#workers.configuration)) {
      for (let i = 0; i < count; i++) {
        const label = `${service}:${i}`
        const worker = this.#workers.get(label)

        status[label] = {
          service,
          worker: i,
          status: worker?.[kWorkerStatus] ?? 'exited',
          thread: worker?.threadId
        }
      }
    }

    return status
  }

  async getCustomHealthChecks () {
    const status = {}

    for (const [service, { count }] of Object.entries(this.#workers.configuration)) {
      for (let i = 0; i < count; i++) {
        const label = `${service}:${i}`
        const worker = this.#workers.get(label)

        status[label] = await sendViaITC(worker, 'getCustomHealthCheck')
      }
    }

    return status
  }

  async getCustomReadinessChecks () {
    const status = {}

    for (const [service, { count }] of Object.entries(this.#workers.configuration)) {
      for (let i = 0; i < count; i++) {
        const label = `${service}:${i}`
        const worker = this.#workers.get(label)

        status[label] = await sendViaITC(worker, 'getCustomReadinessCheck')
      }
    }

    return status
  }

  async getServiceDetails (id, allowUnloaded = false) {
    let service

    try {
      service = await this.#getServiceById(id)
    } catch (e) {
      if (allowUnloaded) {
        return { id, status: 'stopped' }
      }

      throw e
    }

    const { entrypoint, dependencies, localUrl } = service[kConfig]

    const status = await sendViaITC(service, 'getStatus')
    const { type, version } = await sendViaITC(service, 'getServiceInfo')

    const serviceDetails = {
      id,
      type,
      status,
      version,
      localUrl,
      entrypoint,
      dependencies
    }

    if (this.#isProduction) {
      serviceDetails.workers = this.#workers.getCount(id)
    }

    if (entrypoint) {
      serviceDetails.url = status === 'started' ? this.#url : null
    }

    return serviceDetails
  }

  async getService (id, ensureStarted = true) {
    return this.#getServiceById(id, ensureStarted)
  }

  async getServiceConfig (id, ensureStarted = true) {
    const service = await this.#getServiceById(id, ensureStarted)

    return sendViaITC(service, 'getServiceConfig')
  }

  async getServiceEnv (id, ensureStarted = true) {
    const service = await this.#getServiceById(id, ensureStarted)

    return sendViaITC(service, 'getServiceEnv')
  }

  async getServiceOpenapiSchema (id) {
    const service = await this.#getServiceById(id, true)

    return sendViaITC(service, 'getServiceOpenAPISchema')
  }

  async getServiceGraphqlSchema (id) {
    const service = await this.#getServiceById(id, true)

    return sendViaITC(service, 'getServiceGraphQLSchema')
  }

  async getMetrics (format = 'json') {
    let metrics = null

    for (const worker of this.#workers.values()) {
      try {
        // The service might be temporarily unavailable
        if (worker[kWorkerStatus] !== 'started') {
          continue
        }

        const serviceMetrics = await sendViaITC(worker, 'getMetrics', format)
        if (serviceMetrics) {
          if (metrics === null) {
            metrics = format === 'json' ? [] : ''
          }

          if (format === 'json') {
            metrics.push(...serviceMetrics)
          } else {
            metrics += serviceMetrics
          }
        }
      } catch (e) {
        // The service exited while we were sending the ITC, skip it
        if (e.code === 'PLT_RUNTIME_SERVICE_NOT_STARTED' || e.code === 'PLT_RUNTIME_SERVICE_EXIT') {
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

      const servicesMetrics = {}

      for (const metric of metrics) {
        const { name, values } = metric

        if (!metricsNames.includes(name)) continue
        if (!values || values.length === 0) continue

        const labels = values[0].labels
        const serviceId = labels?.serviceId

        if (!serviceId) {
          throw new Error('Missing serviceId label in metrics')
        }

        let serviceMetrics = servicesMetrics[serviceId]
        if (!serviceMetrics) {
          serviceMetrics = {
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
          servicesMetrics[serviceId] = serviceMetrics
        }

        parsePromMetric(serviceMetrics, metric)
      }

      function parsePromMetric (serviceMetrics, promMetric) {
        const { name } = promMetric

        if (name === 'process_cpu_percent_usage') {
          serviceMetrics.cpu = promMetric.values[0].value
          return
        }
        if (name === 'process_resident_memory_bytes') {
          serviceMetrics.rss = promMetric.values[0].value
          return
        }
        if (name === 'nodejs_heap_size_total_bytes') {
          serviceMetrics.totalHeapSize = promMetric.values[0].value
          return
        }
        if (name === 'nodejs_heap_size_used_bytes') {
          serviceMetrics.usedHeapSize = promMetric.values[0].value
          return
        }
        if (name === 'nodejs_heap_space_size_total_bytes') {
          const newSpaceSize = promMetric.values.find(value => value.labels.space === 'new')
          const oldSpaceSize = promMetric.values.find(value => value.labels.space === 'old')

          serviceMetrics.newSpaceSize = newSpaceSize.value
          serviceMetrics.oldSpaceSize = oldSpaceSize.value
          return
        }
        if (name === 'nodejs_eventloop_utilization') {
          serviceMetrics.elu = promMetric.values[0].value
          return
        }
        if (name === 'http_request_all_summary_seconds') {
          serviceMetrics.latency = {
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
        services: servicesMetrics
      }
    } catch (err) {
      // If any metric is missing, return nothing
      this.logger.warn({ err }, 'Cannot fetch metrics')

      return null
    }
  }

  async getServiceMeta (id) {
    const service = await this.#getServiceById(id)

    try {
      return await sendViaITC(service, 'getServiceMeta')
    } catch (e) {
      // The service exports no meta, return an empty object
      if (e.code === 'PLT_ITC_HANDLER_NOT_FOUND') {
        return {}
      }

      throw e
    }
  }

  setServiceConfigPatch (id, patch) {
    this.servicesConfigsPatches.set(id, patch)
  }

  removeServiceConfigPatch (id) {
    this.servicesConfigsPatches.delete(id)
  }

  async getLogIds (runtimePID) {
    runtimePID = runtimePID ?? process.pid

    const runtimeLogFiles = await this.#getRuntimeLogFiles(runtimePID)
    const runtimeLogIds = []

    for (const logFile of runtimeLogFiles) {
      const logId = parseInt(logFile.slice('logs.'.length))
      runtimeLogIds.push(logId)
    }
    return runtimeLogIds
  }

  async getAllLogIds () {
    const runtimesLogFiles = await this.#getAllLogsFiles()
    const runtimesLogsIds = []

    for (const runtime of runtimesLogFiles) {
      const runtimeLogIds = []
      for (const logFile of runtime.runtimeLogFiles) {
        const logId = parseInt(logFile.slice('logs.'.length))
        runtimeLogIds.push(logId)
      }
      runtimesLogsIds.push({
        pid: runtime.runtimePID,
        indexes: runtimeLogIds
      })
    }

    return runtimesLogsIds
  }

  async getLogFileStream (logFileId, runtimePID) {
    const runtimeLogsDir = this.#getRuntimeLogsDir(runtimePID)
    const filePath = join(runtimeLogsDir, `logs.${logFileId}`)
    return createReadStream(filePath)
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

  async sendCommandToService (id, name, message) {
    const service = await this.#getServiceById(id)

    try {
      return await sendViaITC(service, name, message)
    } catch (e) {
      // The service exports no meta, return an empty object
      if (e.code === 'PLT_ITC_HANDLER_NOT_FOUND') {
        return {}
      }

      throw e
    }
  }

  emit (event, payload) {
    for (const worker of this.#workers.values()) {
      if (worker[kForwardEvents]) {
        worker[kITC].notify('runtime:event', { event, payload })
      }
    }

    return super.emit(event, payload)
  }

  async updateSharedContext (options = {}) {
    const { context, overwrite = false } = options

    const sharedContext = overwrite ? {} : this.#sharedContext
    Object.assign(sharedContext, context)

    this.#sharedContext = sharedContext

    const promises = []
    for (const worker of this.#workers.values()) {
      promises.push(
        sendViaITC(worker, 'setSharedContext', sharedContext)
      )
    }

    const results = await Promise.allSettled(promises)
    for (const result of results) {
      if (result.status === 'rejected') {
        this.logger.error({ err: result.reason }, 'Cannot update shared context')
      }
    }

    return sharedContext
  }

  getSharedContext () {
    return this.#sharedContext
  }

  async #setDispatcher (undiciConfig) {
    const config = this.#configManager.current

    const dispatcherOpts = { ...undiciConfig }
    const interceptors = [this.#meshInterceptor]

    if (config.httpCache) {
      this.#sharedHttpCache = await createSharedStore(this.#configManager.dirname, config.httpCache)
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
    this.emit(status, args)
  }

  #showUrl () {
    this.logger.info(`Platformatic is now listening at ${this.#url}`)
  }

  async #setupService (serviceConfig) {
    if (this.#status === 'stopping' || this.#status === 'closed') return

    const config = this.#configManager.current
    const workersCount = await this.#workers.getCount(serviceConfig.id)
    const id = serviceConfig.id

    for (let i = 0; i < workersCount; i++) {
      await this.#setupWorker(config, serviceConfig, workersCount, id, i)
    }

    this.emit('service:init', id)
  }

  async #setupWorker (config, serviceConfig, workersCount, serviceId, index, enabled = true) {
    const { restartOnError } = config
    const workerId = `${serviceId}:${index}`

    // Handle inspector
    let inspectorOptions

    if (this.#configManager.current.inspectorOptions) {
      inspectorOptions = {
        ...this.#configManager.current.inspectorOptions
      }

      inspectorOptions.port = inspectorOptions.port + this.#workers.size + 1
    }

    if (config.telemetry) {
      serviceConfig.telemetry = {
        ...config.telemetry,
        ...serviceConfig.telemetry,
        serviceName: `${config.telemetry.serviceName}-${serviceConfig.id}`
      }
    }

    const errorLabel = this.#workerExtendedLabel(serviceId, index, workersCount)
    const health = deepmerge(config.health ?? {}, serviceConfig.health ?? {})

    const execArgv = []

    if (!serviceConfig.isPLTService && config.telemetry && config.telemetry.enabled !== false) {
      // We need the following because otherwise some open telemetry instrumentations won't work with ESM (like express)
      // see: https://github.com/open-telemetry/opentelemetry-js/blob/main/doc/esm-support.md#instrumentation-hook-required-for-esm
      execArgv.push('--experimental-loader', '@opentelemetry/instrumentation/hook.mjs')
      execArgv.push('--require', openTelemetrySetupPath)
    }

    if ((serviceConfig.sourceMaps ?? config.sourceMaps) === true) {
      execArgv.push('--enable-source-maps')
    }

    const workerEnv = structuredClone(this.#env)

    if (serviceConfig.nodeOptions?.trim().length > 0) {
      const originalNodeOptions = workerEnv['NODE_OPTIONS'] ?? ''

      workerEnv['NODE_OPTIONS'] = `${originalNodeOptions} ${serviceConfig.nodeOptions}`.trim()
    }

    const maxHeapTotal = typeof health.maxHeapTotal === 'string' ? parseMemorySize(health.maxHeapTotal) : health.maxHeapTotal
    const maxYoungGeneration = typeof health.maxYoungGeneration === 'string' ? parseMemorySize(health.maxYoungGeneration) : health.maxYoungGeneration

    const maxOldGenerationSizeMb = Math.floor(
      (maxYoungGeneration > 0 ? maxHeapTotal - maxYoungGeneration : maxHeapTotal) / (1024 * 1024)
    )
    const maxYoungGenerationSizeMb = maxYoungGeneration ? Math.floor(maxYoungGeneration / (1024 * 1024)) : undefined

    const worker = new Worker(kWorkerFile, {
      workerData: {
        config,
        serviceConfig: {
          ...serviceConfig,
          isProduction: this.#isProduction,
          configPatch: this.servicesConfigsPatches.get(serviceId)
        },
        worker: {
          id: workerId,
          index,
          count: workersCount
        },
        inspectorOptions,
        dirname: this.#configManager.dirname,
        runtimeLogsDir: this.#runtimeLogsDir
      },
      argv: serviceConfig.arguments,
      execArgv,
      env: workerEnv,
      resourceLimits: {
        maxOldGenerationSizeMb,
        maxYoungGenerationSizeMb
      },
      stdout: true,
      stderr: true
    })

    this.#handleWorkerStandardStreams(worker, serviceId, workersCount > 1 ? index : undefined)

    // Make sure the listener can handle a lot of API requests at once before raising a warning
    worker.setMaxListeners(1e3)

    // Track service exiting
    const eventPayload = { service: serviceId, worker: index, workersCount }
    worker.once('exit', code => {
      if (worker[kWorkerStatus] === 'exited') {
        return
      }

      const started = worker[kWorkerStatus] === 'started'
      worker[kWorkerStatus] = 'exited'
      this.emit('service:worker:exited', eventPayload)

      this.#cleanupWorker(worker)

      if (this.#status === 'stopping') {
        return
      }

      // Wait for the next tick so that crashed from the thread are logged first
      setImmediate(() => {
        if (started && (!config.watch || code !== 0)) {
          this.emit('service:worker:error', { ...eventPayload, code })
          this.#broadcastWorkers()

          this.logger.warn(`The ${errorLabel} unexpectedly exited with code ${code}.`)
        }

        // Restart the service if it was started
        if (started && this.#status === 'started') {
          if (restartOnError > 0) {
            if (restartOnError < IMMEDIATE_RESTART_MAX_THRESHOLD) {
              this.logger.warn(`The ${errorLabel} is being restarted ...`)
            } else {
              this.logger.warn(`The ${errorLabel} will be restarted in ${restartOnError}ms ...`)
            }

            this.#restartCrashedWorker(config, serviceConfig, workersCount, serviceId, index, false, 0).catch(err => {
              this.logger.error({ err: ensureLoggableError(err) }, `${errorLabel} could not be restarted.`)
            })
          } else {
            this.emit('service:worker:unvailable', eventPayload)
            this.logger.warn(`The ${errorLabel} is no longer available.`)
          }
        }
      })
    })

    worker[kId] = workersCount > 1 ? workerId : serviceId
    worker[kFullId] = workerId
    worker[kServiceId] = serviceId
    worker[kWorkerId] = workersCount > 1 ? index : undefined
    worker[kWorkerStatus] = 'boot'
    worker[kForwardEvents] = false

    if (inspectorOptions) {
      worker[kInspectorOptions] = {
        port: inspectorOptions.port,
        id: serviceId,
        dirname: this.#configManager.dirname
      }
    }

    // Setup ITC
    worker[kITC] = new ITC({
      name: workerId + '-runtime',
      port: worker,
      handlers: {
        ...this.#workerITCHandlers,
        setEventsForwarding (value) {
          worker[kForwardEvents] = value
        }
      }
    })
    worker[kITC].listen()

    // Only activate watch for the first instance
    if (index === 0) {
      // Handle services changes
      // This is not purposely activated on when this.#configManager.current.watch === true
      // so that services can eventually manually trigger a restart. This mechanism is current
      // used by the composer.
      worker[kITC].on('changed', async () => {
        this.emit('service:worker:changed', eventPayload)

        try {
          const wasStarted = worker[kWorkerStatus].startsWith('start')
          await this.stopService(serviceId)

          if (wasStarted) {
            await this.startService(serviceId)
          }

          this.logger?.info(`The service "${serviceId}" has been successfully reloaded ...`)

          if (serviceConfig.entrypoint) {
            this.#showUrl()
          }
        } catch (e) {
          this.logger?.error(e)
        }
      })
    }

    if (enabled) {
      // Store locally
      this.#workers.set(workerId, worker)

      // Setup the interceptor
      this.#meshInterceptor.route(serviceId, worker)
    }

    // Store dependencies
    const [{ dependencies }] = await waitEventFromITC(worker, 'init')

    if (serviceConfig.entrypoint) {
      this.#entrypointId = serviceId
    }

    serviceConfig.dependencies = dependencies
    for (const { envVar, url } of dependencies) {
      if (envVar) {
        serviceConfig.localServiceEnvVars.set(envVar, url)
      }
    }

    // This must be done here as the dependencies are filled above
    worker[kConfig] = { ...serviceConfig, health, workers: workersCount }
    worker[kWorkerStatus] = 'init'
    this.emit('service:worker:init', eventPayload)

    return worker
  }

  async #getHealth (worker) {
    if (features.node.worker.getHeapStatistics) {
      const { used_heap_size: heapUsed, total_heap_size: heapTotal } = await worker.getHeapStatistics()
      const currentELU = worker.performance.eventLoopUtilization()
      const elu = worker[kLastELU]
        ? worker.performance.eventLoopUtilization(currentELU, worker[kLastELU])
        : currentELU
      worker[kLastELU] = currentELU
      return { elu: elu.utilization, heapUsed, heapTotal }
    }

    const health = await worker[kITC].send('getHealth')
    return health
  }

  #setupHealthCheck (config, serviceConfig, workersCount, id, index, worker, errorLabel, timeout) {
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

      const serviceId = worker[kServiceId]
      this.emit('health', {
        id: worker[kId],
        service: serviceId,
        worker: worker[kWorkerId],
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
          this.logger.error(
            { elu: health.elu, maxELU, memoryUsage: health.heapUsed, maxMemoryUsage: maxHeapUsed },
            `The ${errorLabel} is unhealthy. Replacing it ...`
          )

          await this.#replaceWorker(config, serviceConfig, workersCount, id, index, worker)
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
    }, timeout ?? interval)
  }

  async #startWorker (
    config,
    serviceConfig,
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
      this.logger?.info(`Starting the ${label}...`)
    }

    if (!worker) {
      worker = await this.#getWorkerById(id, index, false, false)
    }

    const eventPayload = { service: id, worker: index, workersCount }

    // The service was stopped, recreate the thread
    if (!worker) {
      await this.#setupService(serviceConfig, index)
      worker = await this.#getWorkerById(id, index)
    }

    worker[kWorkerStatus] = 'starting'
    this.emit('service:worker:starting', eventPayload)

    try {
      let workerUrl
      if (config.startTimeout > 0) {
        workerUrl = await executeWithTimeout(sendViaITC(worker, 'start'), config.startTimeout)

        if (workerUrl === kTimeout) {
          this.emit('service:worker:startTimeout', eventPayload)
          this.logger.info(`The ${label} failed to start in ${config.startTimeout}ms. Forcefully killing the thread.`)
          worker.terminate()
          throw new errors.ServiceStartTimeoutError(id, config.startTimeout)
        }
      } else {
        workerUrl = await sendViaITC(worker, 'start')
      }

      await this.#avoidOutOfOrderThreadLogs()

      if (workerUrl) {
        this.#url = workerUrl
      }

      worker[kWorkerStatus] = 'started'
      this.emit('service:worker:started', eventPayload)
      this.#broadcastWorkers()

      if (!silent) {
        this.logger?.info(`Started the ${label}...`)
      }

      const { enabled, gracePeriod } = worker[kConfig].health
      if (enabled && config.restartOnError > 0) {
        // if gracePeriod is 0, it will be set to 1 to start health checks immediately
        // however, the health event will start when the worker is started
        this.#setupHealthCheck(config, serviceConfig, workersCount, id, index, worker, label, gracePeriod > 0 ? gracePeriod : 1)
      }
    } catch (error) {
      // TODO: handle port allocation error here
      if (error.code === 'EADDRINUSE') throw error

      this.#cleanupWorker(worker)

      if (worker[kWorkerStatus] !== 'exited') {
        // This prevent the exit handler to restart service
        worker[kWorkerStatus] = 'exited'
        await worker.terminate()
      }

      this.emit('service:worker:start:error', { ...eventPayload, error })

      if (error.code !== 'PLT_RUNTIME_SERVICE_START_TIMEOUT') {
        this.logger.error({ err: ensureLoggableError(error) }, `Failed to start ${label}.`)
      }

      const restartOnError = config.restartOnError

      if (disableRestartAttempts || !restartOnError) {
        throw error
      }

      if (bootstrapAttempt++ >= MAX_BOOTSTRAP_ATTEMPTS || restartOnError === 0) {
        this.logger.error(`Failed to start ${label} after ${MAX_BOOTSTRAP_ATTEMPTS} attempts.`)
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

      await this.#restartCrashedWorker(config, serviceConfig, workersCount, id, index, silent, bootstrapAttempt)
    }
  }

  async #stopWorker (workersCount, id, index, silent, worker = undefined) {
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

    const eventPayload = { service: id, worker: index, workersCount }

    worker[kWorkerStatus] = 'stopping'
    this.emit('service:worker:stopping', eventPayload)

    const label = this.#workerExtendedLabel(id, index, workersCount)

    if (!silent) {
      this.logger?.info(`Stopping the ${label}...`)
    }

    const exitTimeout = this.#configManager.current.gracefulShutdown.runtime
    const exitPromise = once(worker, 'exit')

    // Always send the stop message, it will shut down workers that only had ITC and interceptors setup
    try {
      await executeWithTimeout(sendViaITC(worker, 'stop'), exitTimeout)
    } catch (error) {
      this.emit('service:worker:stop:timeout', eventPayload)
      this.logger?.info({ error: ensureLoggableError(error) }, `Failed to stop ${label}. Killing a worker thread.`)
    } finally {
      worker[kITC].close()
    }

    if (!silent) {
      this.logger?.info(`Stopped the ${label}...`)
    }

    // Wait for the worker thread to finish, we're going to create a new one if the service is ever restarted
    const res = await executeWithTimeout(exitPromise, exitTimeout)

    // If the worker didn't exit in time, kill it
    if (res === kTimeout) {
      this.emit('service:worker:exit:timeout', eventPayload)
      await worker.terminate()
    }

    await this.#avoidOutOfOrderThreadLogs()

    worker[kWorkerStatus] = 'stopped'
    this.emit('service:worker:stopped', eventPayload)
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
    this.#meshInterceptor.unroute(worker[kServiceId], worker, true)
    worker.removeAllListeners('exit')
    await worker.terminate()

    return this.#cleanupWorker(worker)
  }

  #workerExtendedLabel (serviceId, workerId, workersCount) {
    return workersCount > 1 ? `worker ${workerId} of the service "${serviceId}"` : `service "${serviceId}"`
  }

  async #restartCrashedWorker (config, serviceConfig, workersCount, id, index, silent, bootstrapAttempt) {
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
          await this.#setupWorker(config, serviceConfig, workersCount, id, index)
          await this.#startWorker(config, serviceConfig, workersCount, id, index, silent, bootstrapAttempt)

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

  async #replaceWorker (config, serviceConfig, workersCount, serviceId, index, worker) {
    const workerId = `${serviceId}:${index}`
    let newWorker

    try {
      // Create a new worker
      newWorker = await this.#setupWorker(config, serviceConfig, workersCount, serviceId, index, false)

      // Make sure the runtime hasn't been stopped in the meanwhile
      if (this.#status !== 'started') {
        return this.#discardWorker(newWorker)
      }

      // Add the worker to the mesh
      await this.#startWorker(config, serviceConfig, workersCount, serviceId, index, false, 0, newWorker, true)

      // Make sure the runtime hasn't been stopped in the meanwhile
      if (this.#status !== 'started') {
        return this.#discardWorker(newWorker)
      }

      this.#workers.set(workerId, newWorker)
      this.#meshInterceptor.route(serviceId, newWorker)

      // Remove the old worker and then kill it
      await sendViaITC(worker, 'removeFromMesh')
    } catch (e) {
      newWorker?.terminate?.()
      throw e
    }

    await this.#stopWorker(workersCount, serviceId, index, false, worker)
  }

  async #getServiceById (serviceId, ensureStarted = false, mustExist = true) {
    // If the serviceId includes the worker, properly split
    let workerId
    const matched = serviceId.match(/^(.+):(\d+)$/)

    if (matched) {
      serviceId = matched[1]
      workerId = matched[2]
    }

    return this.#getWorkerById(serviceId, workerId, ensureStarted, mustExist)
  }

  async #getWorkerById (serviceId, workerId, ensureStarted = false, mustExist = true) {
    let worker

    if (typeof workerId !== 'undefined') {
      worker = this.#workers.get(`${serviceId}:${workerId}`)
    } else {
      worker = this.#workers.next(serviceId)
    }

    if (!worker) {
      if (!mustExist && this.#servicesIds.includes(serviceId)) {
        return null
      }

      if (this.#servicesIds.includes(serviceId)) {
        const availableWorkers = Array.from(this.#workers.keys())
          .filter(key => key.startsWith(serviceId + ':'))
          .map(key => key.split(':')[1])
          .join(', ')
        throw new errors.WorkerNotFoundError(workerId, serviceId, availableWorkers)
      } else {
        throw new errors.ServiceNotFoundError(serviceId, Array.from(this.#servicesIds).join(', '))
      }
    }

    if (ensureStarted) {
      const serviceStatus = await sendViaITC(worker, 'getStatus')

      if (serviceStatus !== 'started') {
        throw new errors.ServiceNotStartedError(serviceId)
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

      const service = worker[kServiceId]
      let serviceWorkers = workers.get(service)

      if (!serviceWorkers) {
        serviceWorkers = []
        workers.set(service, serviceWorkers)
      }

      serviceWorkers.push({
        id: worker[kId],
        service: worker[kServiceId],
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

  async #getWorkerMessagingChannel ({ service, worker }, context) {
    const target = await this.#getWorkerById(service, worker, true, true)

    const { port1, port2 } = new MessageChannel()

    // Send the first port to the target
    const response = await executeWithTimeout(
      sendViaITC(target, 'saveMessagingChannel', port1, [port1]),
      this.#configManager.current.messagingTimeout
    )

    if (response === kTimeout) {
      throw new errors.MessagingError(service, 'Timeout while establishing a communication channel.')
    }

    context.transferList = [port2]
    this.emit('service:worker:messagingChannel', { service, worker })
    return port2
  }

  async #getRuntimePackageJson () {
    const runtimeDir = this.#configManager.dirname
    const packageJsonPath = join(runtimeDir, 'package.json')
    const packageJsonFile = await readFile(packageJsonPath, 'utf8')
    const packageJson = JSON.parse(packageJsonFile)
    return packageJson
  }

  #getRuntimeLogsDir (runtimePID) {
    return join(this.#runtimeTmpDir, runtimePID.toString(), 'logs')
  }

  async #getRuntimeLogFiles (runtimePID) {
    const runtimeLogsDir = this.#getRuntimeLogsDir(runtimePID)
    const runtimeLogsFiles = await readdir(runtimeLogsDir)
    return runtimeLogsFiles
      .filter(file => file.startsWith('logs'))
      .sort((log1, log2) => {
        const index1 = parseInt(log1.slice('logs.'.length))
        const index2 = parseInt(log2.slice('logs.'.length))
        return index1 - index2
      })
  }

  async #getAllLogsFiles () {
    try {
      await access(this.#runtimeTmpDir)
    } catch (err) {
      this.logger.error({ err: ensureLoggableError(err) }, 'Cannot access temporary folder.')
      return []
    }

    const runtimePIDs = await readdir(this.#runtimeTmpDir)
    const runtimesLogFiles = []

    for (const runtimePID of runtimePIDs) {
      const runtimeLogsDir = this.#getRuntimeLogsDir(runtimePID)
      const runtimeLogsDirStat = await stat(runtimeLogsDir)
      const runtimeLogFiles = await this.#getRuntimeLogFiles(runtimePID)
      const lastModified = runtimeLogsDirStat.mtime

      runtimesLogFiles.push({
        runtimePID: parseInt(runtimePID),
        runtimeLogFiles,
        lastModified
      })
    }

    return runtimesLogFiles.sort((runtime1, runtime2) => runtime1.lastModified - runtime2.lastModified)
  }

  #handleWorkerStandardStreams (worker, serviceId, workerId) {
    const binding = { name: serviceId }

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
    if (!this.#configManager.current.logger.captureStdio) {
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

  async getServiceResourcesInfo (id) {
    const workers = this.#workers.getCount(id)

    const worker = await this.#getWorkerById(id, 0, false, false)
    const health = worker[kConfig].health

    return { workers, health }
  }

  async #updateServiceConfigWorkers (serviceId, workers) {
    this.logger.info(`Updating service "${serviceId}" config workers to ${workers}`)

    this.#configManager.current.services.find(s => s.id === serviceId).workers = workers
    const service = await this.#getServiceById(serviceId)
    this.#workers.setCount(serviceId, workers)
    service[kConfig].workers = workers

    const promises = []
    for (const [workerId, worker] of this.#workers.entries()) {
      if (workerId.startsWith(`${serviceId}:`)) {
        promises.push(sendViaITC(worker, 'updateWorkersCount', { serviceId, workers }))
      }
    }

    const results = await Promise.allSettled(promises)
    for (const result of results) {
      if (result.status === 'rejected') {
        this.logger.error({ err: result.reason }, `Cannot update service "${serviceId}" workers`)
        throw result.reason
      }
    }
  }

  async #updateServiceConfigHealth (serviceId, health) {
    this.logger.info(`Updating service "${serviceId}" config health heap to ${JSON.stringify(health)}`)
    const { maxHeapTotal, maxYoungGeneration } = health

    const service = this.#configManager.current.services.find(s => s.id === serviceId)
    if (maxHeapTotal) {
      service.health.maxHeapTotal = maxHeapTotal
    }
    if (maxYoungGeneration) {
      service.health.maxYoungGeneration = maxYoungGeneration
    }
  }

  /**
   * Updates the resources of the services, such as the number of workers and health configurations (e.g., heap memory settings).
   *
   * This function handles three update scenarios for each service:
   *  1. **Updating workers only**: Adjusts the number of workers for the service.
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
   * @param {Array<Object>} updates - An array of objects that define the updates for each service.
   * @param {string} updates[].service - The ID of the service to update.
   * @param {number} [updates[].workers] - The desired number of workers for the service. If omitted, workers will not be updated.
   * @param {Object} [updates[].health] - The health configuration to update for the service, which may include:
   *   @param {string|number} [updates[].health.maxHeapTotal] - The maximum heap memory for the service. Can be a valid memory string (e.g., '1G', '512MB') or a number representing bytes.
   *   @param {string|number} [updates[].health.maxYoungGeneration] - The maximum young generation memory for the service. Can be a valid memory string (e.g., '128MB') or a number representing bytes.
   *
   * @returns {Promise<Array<Object>>} - A promise that resolves to an array of reports for each service, detailing the success or failure of the operations:
   *   - `service`: The service ID.
   *   - `workers`: The workers' update report, including the current, new number of workers, started workers, and success status.
   *   - `health`: The health update report, showing the current and new heap settings, updated workers, and success status.
   *
   * @example
   * await runtime.updateServicesResources([
   *   { service: 'service-1', workers: 2, health: { maxHeapTotal: '1G', maxYoungGeneration: '128 MB' } },
   *   { service: 'service-2', health: { maxHeapTotal: '1G' } },
   *   { service: 'service-3', workers: 2 },
   * ])
   *
   * In this example:
   * - `service-1` will have 2 workers and updated heap memory configurations.
   * - `service-2` will have updated heap memory settings (without changing workers).
   * - `service-3` will have its workers set to 2 but no change in memory settings.
   *
   * @throws {InvalidArgumentError} - Throws if any update parameter is invalid, such as:
   *   - Missing service ID.
   *   - Invalid worker count (not a positive integer).
   *   - Invalid memory size format for `maxHeapTotal` or `maxYoungGeneration`.
   * @throws {ServiceNotFoundError} - Throws if the specified service ID does not exist in the current service configuration.
   */
  async updateServicesResources (updates) {
    if (this.#status === 'stopping' || this.#status === 'closed') {
      this.logger.warn('Cannot update service resources when the runtime is stopping or closed')
      return
    }

    const ups = await this.#validateUpdateServiceResources(updates)
    const config = this.#configManager.current

    const report = []
    for (const update of ups) {
      const { serviceId, config: serviceConfig, workers, health, currentWorkers, currentHealth } = update

      if (workers && health) {
        const r = await this.#updateServiceWorkersAndHealth(serviceId, config, serviceConfig, workers, health, currentWorkers, currentHealth)
        report.push({
          service: serviceId,
          workers: r.workers,
          health: r.health
        })
      } else if (health) {
        const r = await this.#updateServiceHealth(serviceId, config, serviceConfig, currentWorkers, currentHealth, health)
        report.push({
          service: serviceId,
          health: r.health
        })
      } else if (workers) {
        const r = await this.#updateServiceWorkers(serviceId, config, serviceConfig, workers, currentWorkers)
        report.push({
          service: serviceId,
          workers: r.workers
        })
      }
    }

    return report
  }

  async #validateUpdateServiceResources (updates) {
    if (!Array.isArray(updates)) {
      throw new errors.InvalidArgumentError('updates', 'must be an array')
    }
    if (updates.length === 0) {
      throw new errors.InvalidArgumentError('updates', 'must have at least one element')
    }

    const config = this.#configManager.current
    const validatedUpdates = []
    for (const update of updates) {
      const { service: serviceId } = update

      if (!serviceId) {
        throw new errors.InvalidArgumentError('service', 'must be a string')
      }
      const serviceConfig = config.services.find(s => s.id === serviceId)
      if (!serviceConfig) {
        throw new errors.ServiceNotFoundError(serviceId, Array.from(this.#servicesIds).join(', '))
      }

      const { workers: currentWorkers, health: currentHealth } = await this.getServiceResourcesInfo(serviceId)

      let workers
      if (update.workers !== undefined) {
        if (typeof update.workers !== 'number') {
          throw new errors.InvalidArgumentError('workers', 'must be a number')
        }
        if (update.workers <= 0) {
          throw new errors.InvalidArgumentError('workers', 'must be greater than 0')
        }
        if (update.workers > MAX_WORKERS) {
          throw new errors.InvalidArgumentError('workers', `must be less than ${MAX_WORKERS}`)
        }

        if (currentWorkers === update.workers) {
          this.logger.warn({ serviceId, workers: update.workers }, 'No change in the number of workers for service')
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
              throw new errors.InvalidArgumentError('maxHeapTotal', 'must be a valid memory size')
            }
          } else if (typeof update.health.maxHeapTotal === 'number') {
            maxHeapTotal = update.health.maxHeapTotal
            if (update.health.maxHeapTotal <= 0) {
              throw new errors.InvalidArgumentError('maxHeapTotal', 'must be greater than 0')
            }
          } else {
            throw new errors.InvalidArgumentError('maxHeapTotal', 'must be a number or a string representing a memory size')
          }

          if (currentHealth.maxHeapTotal === maxHeapTotal) {
            this.logger.warn({ serviceId, maxHeapTotal }, 'No change in the max heap total for service')
            maxHeapTotal = undefined
          }
        }

        if (update.health.maxYoungGeneration !== undefined) {
          if (typeof update.health.maxYoungGeneration === 'string') {
            try {
              maxYoungGeneration = parseMemorySize(update.health.maxYoungGeneration)
            } catch {
              throw new errors.InvalidArgumentError('maxYoungGeneration', 'must be a valid memory size')
            }
          } else if (typeof update.health.maxYoungGeneration === 'number') {
            maxYoungGeneration = update.health.maxYoungGeneration
            if (update.health.maxYoungGeneration <= 0) {
              throw new errors.InvalidArgumentError('maxYoungGeneration', 'must be greater than 0')
            }
          } else {
            throw new errors.InvalidArgumentError('maxYoungGeneration', 'must be a number or a string representing a memory size')
          }

          if (currentHealth.maxYoungGeneration && currentHealth.maxYoungGeneration === maxYoungGeneration) {
            this.logger.warn({ serviceId, maxYoungGeneration }, 'No change in the max young generation for service')
            maxYoungGeneration = undefined
          }
        }
      }

      if (workers || maxHeapTotal || maxYoungGeneration) {
        let health
        if (maxHeapTotal || maxYoungGeneration) {
          health = { }
          if (maxHeapTotal) {
            health.maxHeapTotal = maxHeapTotal
          }
          if (maxYoungGeneration) {
            health.maxYoungGeneration = maxYoungGeneration
          }
        }
        validatedUpdates.push({ serviceId, config: serviceConfig, workers, health, currentWorkers, currentHealth })
      }
    }

    return validatedUpdates
  }

  async #updateServiceWorkersAndHealth (serviceId, config, serviceConfig, workers, health, currentWorkers, currentHealth) {
    if (currentWorkers > workers) {
      // stop workers
      const reportWorkers = await this.#updateServiceWorkers(serviceId, config, serviceConfig, workers, currentWorkers)
      // update heap for current workers
      const reportHealth = await this.#updateServiceHealth(serviceId, config, serviceConfig, workers, currentHealth, health)

      return { workers: reportWorkers, health: reportHealth }
    } else {
      // update service heap
      await this.#updateServiceConfigHealth(serviceId, health)
      // start new workers with new heap
      const reportWorkers = await this.#updateServiceWorkers(serviceId, config, serviceConfig, workers, currentWorkers)
      // update heap for current workers
      const reportHealth = await this.#updateServiceHealth(serviceId, config, serviceConfig, currentWorkers, currentHealth, health, false)

      return { workers: reportWorkers, health: reportHealth }
    }
  }

  async #updateServiceHealth (serviceId, config, serviceConfig, currentWorkers, currentHealth, health, updateConfig = true) {
    const report = {
      current: currentHealth,
      new: health,
      updated: []
    }
    try {
      if (updateConfig) {
        await this.#updateServiceConfigHealth(serviceId, health)
      }

      for (let i = 0; i < currentWorkers; i++) {
        this.logger.info({ health: { current: currentHealth, new: health } }, `Restarting service "${serviceId}" worker ${i} to update config health heap...`)

        const worker = await this.#getWorkerById(serviceId, i)
        if (health.maxHeapTotal) { worker[kConfig].health.maxHeapTotal = health.maxHeapTotal }
        if (health.maxYoungGeneration) { worker[kConfig].health.maxYoungGeneration = health.maxYoungGeneration }

        await this.#replaceWorker(config, serviceConfig, currentWorkers, serviceId, i, worker)
        report.updated.push(i)
        this.logger.info({ health: { current: currentHealth, new: health } }, `Restarted service "${serviceId}" worker ${i}`)
      }
      report.success = true
    } catch (err) {
      if (report.updated.length < 1) {
        this.logger.error({ err }, 'Cannot update service health heap, no worker updated')
        await this.#updateServiceConfigHealth(serviceId, currentHealth)
      } else {
        this.logger.error({ err }, `Cannot update service health heap, updated workers: ${report.updated.length} out of ${currentWorkers}`)
      }
      report.success = false
    }
    return report
  }

  async #updateServiceWorkers (serviceId, config, serviceConfig, workers, currentWorkers) {
    const report = {
      current: currentWorkers,
      new: workers
    }
    if (currentWorkers < workers) {
      report.started = []
      try {
        await this.#updateServiceConfigWorkers(serviceId, workers)
        for (let i = currentWorkers; i < workers; i++) {
          await this.#setupWorker(config, serviceConfig, workers, serviceId, i)
          await this.#startWorker(config, serviceConfig, workers, serviceId, i, false, 0)
          report.started.push(i)
        }
        report.success = true
      } catch (err) {
        if (report.started.length < 1) {
          this.logger.error({ err }, 'Cannot start service workers, no worker started')
          await this.#updateServiceConfigWorkers(serviceId, currentWorkers)
        } else {
          this.logger.error({ err }, `Cannot start service workers, started workers: ${report.started.length} out of ${workers}`)
          await this.#updateServiceConfigWorkers(serviceId, currentWorkers + report.started.length)
        }
        report.success = false
      }
    } else {
      // keep the current workers count until all the service workers are all stopped
      report.stopped = []
      try {
        for (let i = currentWorkers - 1; i >= workers; i--) {
          const worker = await this.#getWorkerById(serviceId, i, false, false)
          await sendViaITC(worker, 'removeFromMesh')
          await this.#stopWorker(currentWorkers, serviceId, i, false, worker)
          report.stopped.push(i)
        }
        await this.#updateServiceConfigWorkers(serviceId, workers)
        report.success = true
      } catch (err) {
        if (report.stopped.length < 1) {
          this.logger.error({ err }, 'Cannot stop service workers, no worker stopped')
        } else {
          this.logger.error({ err }, `Cannot stop service workers, stopped workers: ${report.stopped.length} out of ${workers}`)
          await this.#updateServiceConfigWorkers(serviceId, currentWorkers - report.stopped)
        }
        report.success = false
      }
    }
    return report
  }
}

module.exports = { Runtime }
