'use strict'

const { once, EventEmitter } = require('node:events')
const { createReadStream, watch } = require('node:fs')
const { readdir, readFile, stat, access } = require('node:fs/promises')
const { join } = require('node:path')
const { setTimeout: sleep } = require('node:timers/promises')
const { Worker } = require('node:worker_threads')
const { ITC } = require('@platformatic/itc')
const { ensureLoggableError, executeWithTimeout, deepmerge } = require('@platformatic/utils')
const ts = require('tail-file-stream')
const { createThreadInterceptor } = require('undici-thread-interceptor')

const { checkDependencies, topologicalSort } = require('./dependencies')
const errors = require('./errors')
const { createLogger } = require('./logger')
const { startManagementApi } = require('./management-api')
const { startPrometheusServer } = require('./prom-server')
const { getRuntimeTmpDir } = require('./utils')
const { sendViaITC, waitEventFromITC } = require('./worker/itc')
const { RoundRobinMap } = require('./worker/round-robin-map.js')
const {
  kId,
  kServiceId,
  kWorkerId,
  kITC,
  kHealthCheckTimer,
  kConfig,
  kLoggerDestination,
  kLoggingPort,
  kWorkerStatus
} = require('./worker/symbols')

const fastify = require('fastify')

const platformaticVersion = require('../package.json').version
const kWorkerFile = join(__dirname, 'worker/main.js')

const kInspectorOptions = Symbol('plt.runtime.worker.inspectorOptions')

const MAX_LISTENERS_COUNT = 100
const MAX_METRICS_QUEUE_LENGTH = 5 * 60 // 5 minutes in seconds
const COLLECT_METRICS_TIMEOUT = 1000

const MAX_BOOTSTRAP_ATTEMPTS = 5

const telemetryPath = require.resolve('@platformatic/telemetry')
const openTelemetrySetupPath = join(telemetryPath, '..', 'lib', 'node-http-telemetry.js')

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
  #status
  #interceptor
  #managementApi
  #prometheusServer
  #inspectorServer
  #workers
  #restartingWorkers

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
    // Note: nothing hits the main thread so there is no reason to set the globalDispatcher here
    this.#interceptor = createThreadInterceptor({ domain: '.plt.local', timeout: true })
    this.#status = undefined
    this.#restartingWorkers = new Map()
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
    const [logger, destination] = createLogger(config, this.#runtimeLogsDir)
    this.logger = logger
    this.#loggerDestination = destination

    this.#isProduction = this.#configManager.args?.production ?? false
    this.#servicesIds = config.services.map(service => service.id)
    this.#workers.configure(config.services, this.#configManager.current.workers, this.#isProduction)

    // Create all services, each in is own worker thread
    for (const serviceConfig of config.services) {
      await this.#setupService(serviceConfig)
    }

    try {
      // Make sure the list exists before computing the dependencies, otherwise some services might not be stopped

      if (autoloadEnabled) {
        checkDependencies(config.services)
        this.#workers = topologicalSort(this.#workers, config)
      }

      // Recompute the list of services after sorting
      this.#servicesIds = config.services.map(service => service.id)
    } catch (e) {
      await this.close()
      throw e
    }

    this.#updateStatus('init')
  }

  async start (silent = false) {
    if (typeof this.#configManager.current.entrypoint === 'undefined') {
      throw new errors.MissingEntrypointError()
    }
    this.#updateStatus('starting')

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
      // Wait for the next tick so that the error is logged first
      await sleep(1)
      await this.close()
      throw error
    }

    this.#updateStatus('started')

    if (this.#managementApi && typeof this.#metrics === 'undefined') {
      this.startCollectingMetrics()
    }

    this.#showUrl()
    return this.#url
  }

  async stop (silent = false) {
    if (this.#status === 'starting') {
      await once(this, 'started')
    }

    this.#updateStatus('stopping')

    if (this.#inspectorServer) {
      await this.#inspectorServer.close()
    }

    for (const service of this.#servicesIds) {
      await this.stopService(service, silent)
    }

    this.#updateStatus('stopped')
  }

  async restart () {
    this.emit('restarting')

    await this.stop()
    await this.start()

    this.emit('restarted')

    return this.#url
  }

  getRuntimeStatus () {
    return this.#status
  }

  async close (fromManagementApi = false, silent = false) {
    this.#updateStatus('closing')

    clearInterval(this.#metricsTimeout)

    await this.stop(silent)

    if (this.#managementApi) {
      if (fromManagementApi) {
        // This allow a close request coming from the management API to correctly be handled
        setImmediate(() => {
          this.#managementApi.close()
        })
      } else {
        await this.#managementApi.close()
      }
    }

    if (this.#prometheusServer) {
      await this.#prometheusServer.close()
    }

    if (this.logger) {
      this.#loggerDestination.end()

      this.logger = null
      this.#loggerDestination = null
    }

    this.#updateStatus('closed')
  }

  async startService (id, silent) {
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

    for (let i = 0; i < workersCount; i++) {
      await this.#startWorker(config, serviceConfig, workersCount, id, i, silent)
    }
  }

  async stopService (id, silent) {
    const config = this.#configManager.current
    const serviceConfig = config.services.find(s => s.id === id)

    if (!serviceConfig) {
      throw new errors.ServiceNotFoundError(id, Array.from(this.#servicesIds).join(', '))
    }

    const workersCount = await this.#workers.getCount(serviceConfig.id)

    for (let i = 0; i < workersCount; i++) {
      await this.#stopWorker(workersCount, id, i, silent)
    }
  }

  async buildService (id) {
    const service = await this.#getServiceById(id)

    try {
      return await sendViaITC(service, 'build')
    } catch (e) {
      // The service exports no meta, return an empty object
      if (e.code === 'PLT_ITC_HANDLER_NOT_FOUND') {
        return {}
      }

      throw e
    }
  }

  async inject (id, injectParams) {
    const service = await this.#getServiceById(id, true)
    return sendViaITC(service, 'inject', injectParams)
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
    return this.#interceptor
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

  async getService (id) {
    return this.#getServiceById(id, true)
  }

  async getServiceConfig (id) {
    const service = await this.#getServiceById(id, true)

    return sendViaITC(service, 'getServiceConfig')
  }

  async getServiceEnv (id) {
    const service = await this.#getServiceById(id, true)

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

      if (metrics === null) {
        return null
      }

      const cpuMetric = metrics.find(metric => metric.name === 'process_cpu_percent_usage')
      const rssMetric = metrics.find(metric => metric.name === 'process_resident_memory_bytes')
      const totalHeapSizeMetric = metrics.find(metric => metric.name === 'nodejs_heap_size_total_bytes')
      const usedHeapSizeMetric = metrics.find(metric => metric.name === 'nodejs_heap_size_used_bytes')
      const heapSpaceSizeTotalMetric = metrics.find(metric => metric.name === 'nodejs_heap_space_size_total_bytes')
      const newSpaceSizeTotalMetric = heapSpaceSizeTotalMetric.values.find(value => value.labels.space === 'new')
      const oldSpaceSizeTotalMetric = heapSpaceSizeTotalMetric.values.find(value => value.labels.space === 'old')
      const eventLoopUtilizationMetric = metrics.find(metric => metric.name === 'nodejs_eventloop_utilization')

      let p50Value = 0
      let p90Value = 0
      let p95Value = 0
      let p99Value = 0

      const metricName = 'http_request_all_summary_seconds'
      const httpLatencyMetrics = metrics.filter(metric => metric.name === metricName)

      if (httpLatencyMetrics) {
        const entrypointMetrics = httpLatencyMetrics.find(
          metric => metric.values?.[0]?.labels?.serviceId === this.#entrypointId
        )
        if (entrypointMetrics) {
          p50Value = entrypointMetrics.values.find(value => value.labels.quantile === 0.5)?.value || 0
          p90Value = entrypointMetrics.values.find(value => value.labels.quantile === 0.9)?.value || 0
          p95Value = entrypointMetrics.values.find(value => value.labels.quantile === 0.95)?.value || 0
          p99Value = entrypointMetrics.values.find(value => value.labels.quantile === 0.99)?.value || 0

          p50Value = Math.round(p50Value * 1000)
          p90Value = Math.round(p90Value * 1000)
          p95Value = Math.round(p95Value * 1000)
          p99Value = Math.round(p99Value * 1000)
        }
      }

      const cpu = cpuMetric.values[0].value
      const rss = rssMetric.values[0].value
      const elu = eventLoopUtilizationMetric.values[0].value
      const totalHeapSize = totalHeapSizeMetric.values[0].value
      const usedHeapSize = usedHeapSizeMetric.values[0].value
      const newSpaceSize = newSpaceSizeTotalMetric.value
      const oldSpaceSize = oldSpaceSizeTotalMetric.value

      const formattedMetrics = {
        version: 1,
        date: new Date().toISOString(),
        cpu,
        elu,
        rss,
        totalHeapSize,
        usedHeapSize,
        newSpaceSize,
        oldSpaceSize,
        entrypoint: {
          latency: {
            p50: p50Value,
            p90: p90Value,
            p95: p95Value,
            p99: p99Value
          }
        }
      }

      return formattedMetrics
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

  #updateStatus (status) {
    this.#status = status
    this.emit(status)
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
  }

  async #setupWorker (config, serviceConfig, workersCount, serviceId, index) {
    const { autoload, restartOnError } = config
    const workerId = `${serviceId}:${index}`

    const { port1: loggerDestination, port2: loggingPort } = new MessageChannel()
    loggerDestination.on('message', this.#forwardThreadLog.bind(this))

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
        serviceName: `${config.telemetry.serviceName}-${serviceConfig.id}`
      }
    }

    const errorLabel = this.#workerExtendedLabel(serviceId, index, workersCount)
    const health = deepmerge(config.health ?? {}, serviceConfig.health ?? {})

    const worker = new Worker(kWorkerFile, {
      workerData: {
        config,
        serviceConfig: {
          ...serviceConfig,
          isProduction: this.#isProduction
        },
        worker: {
          id: workerId,
          index,
          count: workersCount
        },
        inspectorOptions,
        dirname: this.#configManager.dirname,
        runtimeLogsDir: this.#runtimeLogsDir,
        loggingPort
      },
      execArgv: serviceConfig.isPLTService ? [] : ['--require', openTelemetrySetupPath],
      env: this.#env,
      transferList: [loggingPort],
      resourceLimits: {
        maxOldGenerationSizeMb: health.maxHeapTotal
      },
      /*
        Important: always set stdout and stderr to true, so that worker's output is not automatically
        piped to the parent thread. We actually never output the thread output since we replace it
        with PinoWritable, and disabling the piping avoids us to redeclare some internal Node.js methods.

        The author of this (Paolo and Matteo) are not proud of the solution. Forgive us.
      */
      stdout: true,
      stderr: true
    })

    // Make sure the listener can handle a lot of API requests at once before raising a warning
    worker.setMaxListeners(1e3)

    // Track service exiting
    worker.once('exit', code => {
      if (worker[kWorkerStatus] === 'exited') {
        return
      }

      const started = worker[kWorkerStatus] === 'started'
      worker[kWorkerStatus] = 'exited'

      this.#cleanupWorker(workerId, worker)

      if (this.#status === 'stopping') {
        return
      }

      // Wait for the next tick so that crashed from the thread are logged first
      setImmediate(() => {
        if (started && (!config.watch || code !== 0)) {
          this.logger.warn(`The ${errorLabel} unexpectedly exited with code ${code}.`)
        }

        // Restart the service if it was started
        if (started && this.#status === 'started') {
          if (restartOnError > 0) {
            this.logger.warn(`The ${errorLabel} will be restarted in ${restartOnError}ms...`)
            this.#restartCrashedWorker(config, serviceConfig, workersCount, serviceId, index, false, 0).catch(err => {
              this.logger.error({ err: ensureLoggableError(err) }, `${errorLabel} could not be restarted.`)
            })
          } else {
            this.logger.warn(`The ${errorLabel} is no longer available.`)
          }
        }
      })
    })

    worker[kId] = workersCount > 1 ? workerId : serviceId
    worker[kServiceId] = serviceId
    worker[kWorkerId] = workersCount > 1 ? index : undefined
    worker[kLoggerDestination] = loggerDestination
    worker[kLoggingPort] = loggingPort

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
        getServiceMeta: this.getServiceMeta.bind(this),
        listServices: () => {
          return this.#servicesIds
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
        try {
          const wasStarted = worker[kWorkerStatus].startsWith('start')
          await this.stopService(serviceId)

          if (wasStarted) {
            await this.startService(serviceId)
          }

          this.logger?.info(`Service "${serviceId}" has been successfully reloaded ...`)

          if (serviceConfig.entrypoint) {
            this.#showUrl()
          }
        } catch (e) {
          this.logger?.error(e)
        }
      })
    }

    // Store locally
    this.#workers.set(workerId, worker)

    if (serviceConfig.entrypoint) {
      this.#entrypointId = serviceId
    }

    // Setup the interceptor
    this.#interceptor.route(serviceId, worker)

    // Store dependencies
    const [{ dependencies }] = await waitEventFromITC(worker, 'init')

    if (autoload) {
      serviceConfig.dependencies = dependencies
      for (const { envVar, url } of dependencies) {
        if (envVar) {
          serviceConfig.localServiceEnvVars.set(envVar, url)
        }
      }
    }

    // This must be done here as the dependencies are filled above
    worker[kConfig] = { ...serviceConfig, health }
    worker[kWorkerStatus] = 'boot'
  }

  #setupHealthCheck (worker, errorLabel) {
    // Clear the timeout when exiting
    worker.on('exit', () => clearTimeout(worker[kHealthCheckTimer]))

    const { maxELU, maxHeapUsed, maxHeapTotal, maxUnhealthyChecks, interval } = worker[kConfig].health
    let unhealthyChecks = 0

    worker[kHealthCheckTimer] = setTimeout(async () => {
      const health = await worker[kITC].send('getHealth')
      this.emit('health', {
        id: worker[kId],
        service: worker[kServiceId],
        worker: worker[kWorkerId],
        currentHealth: health,
        healthConfig: worker[kConfig].health
      })

      const { elu, heapUsed } = health
      const memoryUsage = heapUsed / maxHeapTotal
      if (elu > maxELU || memoryUsage > maxHeapUsed) {
        unhealthyChecks++
      } else {
        unhealthyChecks = 0
      }

      if (unhealthyChecks >= maxUnhealthyChecks) {
        this.logger.error(`The ${errorLabel} is unhealthy. Forcefully terminating it ...`)
        worker.terminate()
        return
      }

      worker[kHealthCheckTimer].refresh()
    }, interval)
  }

  async #startWorker (config, serviceConfig, workersCount, id, index, silent, bootstrapAttempt = 0) {
    const workerId = `${id}:${index}`
    const label = this.#workerExtendedLabel(id, index, workersCount)

    if (!silent) {
      this.logger?.info(`Starting the ${label}...`)
    }

    let worker = await this.#getWorkerById(id, index, false, false)

    // The service was stopped, recreate the thread
    if (!worker) {
      await this.#setupService(serviceConfig, index)
      worker = await this.#getWorkerById(id, index)
    }

    worker[kWorkerStatus] = 'starting'

    try {
      let workerUrl
      if (config.startTimeout > 0) {
        workerUrl = await executeWithTimeout(sendViaITC(worker, 'start'), config.startTimeout)

        if (workerUrl === 'timeout') {
          this.logger.info(`The ${label} failed to start in ${config.startTimeout}ms. Forcefully killing the thread.`)
          worker.terminate()
          throw new errors.ServiceStartTimeoutError(id, config.startTimeout)
        }
      } else {
        workerUrl = await sendViaITC(worker, 'start')
      }

      if (workerUrl) {
        this.#url = workerUrl
      }

      worker[kWorkerStatus] = 'started'

      if (!silent) {
        this.logger?.info(`Started the ${label}...`)
      }

      const { enabled, gracePeriod } = worker[kConfig].health
      if (enabled && config.restartOnError > 0) {
        worker[kHealthCheckTimer] = setTimeout(
          () => {
            this.#setupHealthCheck(worker, label)
          },
          gracePeriod > 0 ? gracePeriod : 1
        )
      }
    } catch (error) {
      // TODO: handle port allocation error here
      if (error.code === 'EADDRINUSE') throw error

      this.#cleanupWorker(workerId, worker)

      if (worker[kWorkerStatus] !== 'exited') {
        // This prevent the exit handler to restart service
        worker[kWorkerStatus] = 'exited'
        await worker.terminate()
      }

      if (error.code !== 'PLT_RUNTIME_SERVICE_START_TIMEOUT') {
        this.logger.error({ err: ensureLoggableError(error) }, `Failed to start ${label}.`)
      }

      const restartOnError = config.restartOnError

      if (!restartOnError) {
        throw error
      }

      if (bootstrapAttempt++ >= MAX_BOOTSTRAP_ATTEMPTS || restartOnError === 0) {
        this.logger.error(`Failed to start ${label} after ${MAX_BOOTSTRAP_ATTEMPTS} attempts.`)
        throw error
      }

      this.logger.warn(
        `Attempt ${bootstrapAttempt} of ${MAX_BOOTSTRAP_ATTEMPTS} to start the ${label} again will be performed in ${restartOnError}ms ...`
      )

      await this.#restartCrashedWorker(config, serviceConfig, workersCount, id, index, silent, bootstrapAttempt)
    }
  }

  async #stopWorker (workersCount, id, index, silent) {
    const worker = await this.#getWorkerById(id, index, false, false)

    if (!worker) {
      return
    }

    worker[kWorkerStatus] = 'stopping'

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
    if (res === 'timeout') {
      await worker.terminate()
    }

    worker[kWorkerStatus] = 'stopped'
  }

  #cleanupWorker (workerId, worker) {
    this.#workers.delete(workerId)

    worker[kITC].close()
    worker[kLoggerDestination].close()
    worker[kLoggingPort].close()
    clearTimeout(worker[kHealthCheckTimer])
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
      setTimeout(async () => {
        this.#restartingWorkers.delete(workerId)

        // If some processes were scheduled to restart
        // but the runtime is stopped, ignore it
        if (!this.#status.startsWith('start')) {
          return
        }

        try {
          await this.#setupWorker(config, serviceConfig, workersCount, id, index)
          await this.#startWorker(config, serviceConfig, workersCount, id, index, silent, bootstrapAttempt)

          resolve()
        } catch (err) {
          // The runtime was stopped while the restart was happening, ignore any error.
          if (!this.#status.startsWith('start')) {
            resolve()
          }

          reject(err)
        }
      }, config.restartOnError)
    })

    this.#restartingWorkers.set(workerId, restartPromise)
    await restartPromise
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

      throw new errors.ServiceNotFoundError(serviceId, Array.from(this.#servicesIds).join(', '))
    }

    if (ensureStarted) {
      const serviceStatus = await sendViaITC(worker, 'getStatus')

      if (serviceStatus !== 'started') {
        throw new errors.ServiceNotStartedError(serviceId)
      }
    }

    return worker
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

  #forwardThreadLog (message) {
    if (!this.#loggerDestination) {
      return
    }

    for (const log of message.logs) {
      // In order to being able to forward messages serialized in the
      // worker threads by directly writing to the destinations using multistream
      // we unfortunately need to reparse the message to set some internal flags
      // of the destination which are never set since we bypass pino.
      let message = JSON.parse(log)
      let { level, time, msg, raw } = message

      try {
        const parsed = JSON.parse(raw.trimEnd())

        if (typeof parsed.level === 'number' && typeof parsed.time === 'number') {
          level = parsed.level
          time = parsed.time
          message = parsed
        } else {
          message.raw = undefined
          message.payload = parsed
        }
      } catch {
        if (typeof message.raw === 'string') {
          message.msg = message.raw.replace(/\n$/, '')
        }

        message.raw = undefined
      }

      this.#loggerDestination.lastLevel = level
      this.#loggerDestination.lastTime = time
      this.#loggerDestination.lastMsg = msg
      this.#loggerDestination.lastObj = message
      this.#loggerDestination.lastLogger = this.logger

      // Never drop the `\n` as the worker thread trimmed the message
      this.#loggerDestination.write(JSON.stringify(message) + '\n')
    }
  }
}

module.exports = { Runtime }
