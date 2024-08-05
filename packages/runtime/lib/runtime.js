'use strict'

const { once, EventEmitter } = require('node:events')
const { createReadStream, watch } = require('node:fs')
const { readdir, readFile, stat, access } = require('node:fs/promises')
const inspector = require('node:inspector')
const { join } = require('node:path')
const { setTimeout: sleep } = require('node:timers/promises')
const { Worker } = require('node:worker_threads')

const { ITC } = require('@platformatic/itc')
const ts = require('tail-file-stream')
const { createThreadInterceptor } = require('undici-thread-interceptor')

const { checkDependencies, topologicalSort } = require('./dependencies')
const errors = require('./errors')
const { createLogger } = require('./logger')
const { startManagementApi } = require('./management-api')
const { startPrometheusServer } = require('./prom-server')
const { getRuntimeTmpDir } = require('./utils')
const { sendViaITC } = require('./worker/itc')
const { kId, kITC, kConfig } = require('./worker/symbols')

const platformaticVersion = require('../package.json').version
const kWorkerFile = join(__dirname, 'worker/main.js')

const MAX_LISTENERS_COUNT = 100
const MAX_METRICS_QUEUE_LENGTH = 5 * 60 // 5 minutes in seconds
const COLLECT_METRICS_TIMEOUT = 1000

class Runtime extends EventEmitter {
  #configManager
  #runtimeTmpDir
  #runtimeLogsDir
  #env
  #services
  #servicesIds
  #entrypoint
  #entrypointId
  #url
  #loggerDestination
  #metrics
  #metricsTimeout
  #status
  #interceptor
  #managementApi
  #prometheusServer
  #startedServices
  #crashedServicesTimers

  constructor (configManager, runtimeLogsDir, env) {
    super()
    this.setMaxListeners(MAX_LISTENERS_COUNT)

    this.#configManager = configManager
    this.#runtimeTmpDir = getRuntimeTmpDir(configManager.dirname)
    this.#runtimeLogsDir = runtimeLogsDir
    this.#env = env
    this.#services = new Map()
    this.#servicesIds = []
    this.#url = undefined
    // Note: nothing hits the main thread so there is no reason to set the globalDispatcher here
    this.#interceptor = createThreadInterceptor({ domain: '.plt.local' })
    this.#status = undefined
    this.#startedServices = new Map()
    this.#crashedServicesTimers = new Map()
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

    // Handle inspector
    const inspectorOptions = config.inspectorOptions
    if (inspectorOptions) {
      /* c8 ignore next 6 */
      if (inspectorOptions.watchDisabled) {
        logger.info('debugging flags were detected. hot reloading has been disabled')
      }

      inspector.open(inspectorOptions.port, inspectorOptions.host, inspectorOptions.breakFirstLine)
    }

    // Create all services, each in is own worker thread
    for (const serviceConfig of config.services) {
      // Setup forwarding of logs from the worker threads to the main thread
      await this.#setupService(serviceConfig)
    }

    try {
      // Make sure the list exists before computing the dependencies, otherwise some services might not be stopped
      this.#servicesIds = config.services.map(service => service.id)

      if (autoloadEnabled) {
        checkDependencies(config.services)
        this.#services = topologicalSort(this.#services, config)
      }

      // Recompute the list of services after sorting
      this.#servicesIds = config.services.map(service => service.id)
    } catch (e) {
      await this.close()
      throw e
    }

    this.#updateStatus('init')
  }

  async start () {
    this.#updateStatus('starting')

    // Important: do not use Promise.all here since it won't properly manage dependencies
    for (const service of this.#servicesIds) {
      await this.startService(service)
    }

    this.#updateStatus('started')

    if (this.#managementApi && typeof this.#metrics === 'undefined') {
      this.startCollectingMetrics()
    }

    return this.#url
  }

  async stop () {
    if (this.#status === 'starting') {
      await once(this, 'started')
    }

    this.#updateStatus('stopping')

    for (const timer of this.#crashedServicesTimers.values()) {
      clearTimeout(timer)
    }

    this.#startedServices.clear()
    this.#crashedServicesTimers.clear()

    await Promise.all(this.#servicesIds.map(service => this._stopService(service)))

    this.#updateStatus('stopped')
  }

  async restart () {
    this.emit('restarting')

    await this.stop()
    await this.start()

    this.emit('restarted')

    return this.#url
  }

  async close (fromManagementApi) {
    this.#updateStatus('closing')

    clearInterval(this.#metricsTimeout)

    await this.stop()

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

  async startService (id) {
    if (this.#startedServices.get(id)) {
      throw new errors.ApplicationAlreadyStartedError()
    }

    // This is set here so that if the service fails while starting we track the status
    this.#startedServices.set(id, true)

    // Make sure we don't restart twice
    const crashedTimer = this.#crashedServicesTimers.get(id)
    if (crashedTimer) {
      clearTimeout(crashedTimer)
    }

    let service = await this.#getServiceById(id, false, false)

    // The service was stopped, recreate the thread
    if (!service) {
      const config = this.#configManager.current
      const serviceConfig = config.services.find(s => s.id === id)

      await this.#setupService(serviceConfig)
      service = await this.#getServiceById(id)
    }

    const serviceUrl = await sendViaITC(service, 'start')

    if (serviceUrl) {
      this.#url = serviceUrl
    }
  }

  // Do not rename to #stopService as this is used in tests
  async _stopService (id) {
    const service = await this.#getServiceById(id, false, false)

    if (!service) {
      return
    }

    this.#startedServices.set(id, false)

    // Always send the stop message, it will shut down workers that only had ITC and interceptors setup
    await Promise.race([sendViaITC(service, 'stop'), sleep(10000, 'timeout', { ref: false })])

    // Wait for the worker thread to finish, we're going to create a new one if the service is ever restarted
    const res = await Promise.race([once(service, 'exit'), sleep(10000, 'timeout', { ref: false })])

    // If the worker didn't exit in time, kill it
    if (res === 'timeout') {
      await service.terminate()
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
      platformaticVersion,
    }
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
      services: await Promise.all(this.#servicesIds.map(id => this.getServiceDetails(id))),
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
      dependencies,
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

    for (const id of this.#servicesIds) {
      try {
        const service = await this.#getServiceById(id, true, false)

        // The service might be temporarily unavailable
        if (!service) {
          continue
        }

        const serviceMetrics = await sendViaITC(service, 'getMetrics', format)

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
      const httpLatencyMetrics = metrics.find(metric => metric.name === metricName)

      p50Value = httpLatencyMetrics.values.find(value => value.labels.quantile === 0.5).value || 0
      p90Value = httpLatencyMetrics.values.find(value => value.labels.quantile === 0.9).value || 0
      p95Value = httpLatencyMetrics.values.find(value => value.labels.quantile === 0.95).value || 0
      p99Value = httpLatencyMetrics.values.find(value => value.labels.quantile === 0.99).value || 0

      p50Value = Math.round(p50Value * 1000)
      p90Value = Math.round(p90Value * 1000)
      p95Value = Math.round(p95Value * 1000)
      p99Value = Math.round(p99Value * 1000)

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
            p99: p99Value,
          },
        },
      }

      return formattedMetrics
    } catch (err) {
      // If any metric is missing, return nothing
      this.logger.warn({ err }, 'Cannot fetch metrics')

      return null
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
        indexes: runtimeLogIds,
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

  async #setupService (serviceConfig) {
    const config = this.#configManager.current
    const { autoload, restartOnError } = config

    const id = serviceConfig.id
    const { port1: loggerDestination, port2: loggingPort } = new MessageChannel()
    loggerDestination.on('message', this.#forwardThreadLog.bind(this))

    const service = new Worker(kWorkerFile, {
      workerData: {
        config,
        serviceConfig,
        dirname: this.#configManager.dirname,
        runtimeLogsDir: this.#runtimeLogsDir,
        loggingPort,
      },
      execArgv: [], // Avoid side effects
      env: this.#env,
      transferList: [loggingPort],
    })

    // Make sure the listener can handle a lot of API requests at once before raising a warning
    service.setMaxListeners(1e3)

    // Track service exiting
    service.once('exit', code => {
      const started = this.#startedServices.get(id)
      this.#services.delete(id)
      loggerDestination.close()
      loggingPort.close()

      // Wait for the next tick so that crashed from the thread are logged first
      setImmediate(() => {
        // If this was started, it means it crashed
        if (started && (this.#status === 'started' || this.#status === 'starting')) {
          if (restartOnError > 0) {
            this.#restartCrashedService(serviceConfig, code, started)
          } else {
            this.logger.warn(
              `Service ${id} unexpectedly exited with code ${code}. The service is no longer available ...`
            )
          }
        }
      })
    })

    service[kId] = id
    service[kConfig] = serviceConfig

    // Setup ITC
    service[kITC] = new ITC({ port: service })
    service[kITC].listen()

    // Handle services changes
    // This is not purposely activated on when this.#configManager.current.watch === true
    // so that services can eventually manually trigger a restart. This mechanism is current
    // used by the composer
    service[kITC].on('changed', async () => {
      try {
        const wasStarted = this.#startedServices.get(id)

        await this._stopService(id)

        if (wasStarted) {
          await this.startService(id)
        }

        this.logger.info(`Service ${id} has been successfully reloaded ...`)
      } catch (e) {
        this.logger.error(e)
      }
    })

    // Store locally
    this.#services.set(id, service)

    if (serviceConfig.entrypoint) {
      this.#entrypoint = service
      this.#entrypointId = id
    }

    // Setup the interceptor
    this.#interceptor.route(id, service)

    // Store dependencies
    const [{ dependencies }] = await once(service[kITC], 'init')

    if (autoload) {
      serviceConfig.dependencies = dependencies
      for (const { envVar, url } of dependencies) {
        if (envVar) {
          serviceConfig.localServiceEnvVars.set(envVar, url)
        }
      }
    }
  }

  async #restartCrashedService (serviceConfig, code, started) {
    const restartTimeout = this.#configManager.current.restartOnError
    const id = serviceConfig.id

    this.logger.warn(`Service ${id} unexpectedly exited with code ${code}. Restarting in ${restartTimeout}ms ...`)

    const timer = setTimeout(async () => {
      try {
        await this.#setupService(serviceConfig)

        if (started) {
          this.#startedServices.set(id, false)
          await this.startService(id)
        }
      } catch (err) {
        this.logger.error({ err }, `Failed to restart service ${id}.`)
      }
    }, restartTimeout).unref()

    this.#crashedServicesTimers.set(id, timer)
  }

  async #getServiceById (id, ensureStarted = false, mustExist = true) {
    const service = this.#services.get(id)

    if (!service) {
      if (!mustExist && this.#servicesIds.includes(id)) {
        return null
      }

      throw new errors.ServiceNotFoundError(id, Array.from(this.#services.keys()).join(', '))
    }

    if (ensureStarted) {
      const serviceStatus = await sendViaITC(service, 'getStatus')

      if (serviceStatus !== 'started') {
        throw new errors.ServiceNotStartedError(id)
      }
    }

    return service
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
      this.logger.error({ err }, 'Cannot access temporary folder.')
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
        lastModified,
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
        const parsed = JSON.parse(raw)

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
          message.msg = message.raw
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
