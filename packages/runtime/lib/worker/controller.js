import {
  ensureLoggableError,
  FileWatcher,
  kHandledError,
  listRecognizedConfigurationFiles,
  loadConfiguration,
  loadConfigurationModule,
  mirrorGlobalDispatcherForBuiltinFetch
} from '@platformatic/foundation'
import {
  getLogger,
  getOnActiveResourcesEventLoop,
  getOnHttpStatsConnected,
  getOnHttpStatsFree,
  getOnHttpStatsPending,
  getOnHttpStatsQueued,
  getOnHttpStatsRunning,
  getOnHttpStatsSize
} from '@platformatic/globals'
import debounce from 'debounce'
import { EventEmitter } from 'node:events'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { getActiveResourcesInfo } from 'node:process'
import { workerData } from 'node:worker_threads'
import { getGlobalDispatcher, setGlobalDispatcher } from 'undici'
import { ApplicationAlreadyStartedError, InvalidArgumentError, RuntimeNotStartedError } from '../errors.js'
import { getApplicationUrl } from '../utils.js'
import { markAsPlatformaticDispatcher, refreshGlobalDispatcher } from './interceptors.js'

function fetchApplicationUrl (application, key) {
  if (!key.endsWith('_URL') || !application.id) {
    return null
  }

  return getApplicationUrl(application.id)
}

function handleUnhandled (app, event, listeners, timeout, err, ...args) {
  const label = `worker ${workerData.worker.index} of the application "${workerData.applicationConfig.id}"`

  const logger = getLogger()
  logger.error({ err: ensureLoggableError(err) }, `The ${label} threw an ${event} event.`)

  // Give some time to the listeners, logger and ITC notifications to land before shutting down
  setTimeout(() => process.exit(1), timeout)

  for (const listener of listeners) {
    try {
      listener(err, ...args)
    } catch (err) {
      logger.error({ err: ensureLoggableError(err) }, `${event} error listener failed.`)
    }
  }

  app.stop().catch()
}

export class Controller extends EventEmitter {
  #starting
  #started
  #listening
  #watch
  #fileWatcher
  #debouncedRestart
  #context

  constructor (runtimeConfig, applicationConfig, workerId, serverConfig, metricsConfig) {
    super()
    this.runtimeConfig = runtimeConfig
    this.applicationConfig = applicationConfig
    this.applicationId = this.applicationConfig.id
    this.workerId = workerId
    this.#watch = !!runtimeConfig.watch
    this.#starting = false
    this.#started = false
    this.#listening = false
    this.capability = null
    this.#fileWatcher = null

    this.#context = {
      controller: this,
      runtimeConfig: this.runtimeConfig,
      applicationConfig: this.applicationConfig,
      applicationId: this.applicationId,
      workerId: this.workerId,
      directory: this.applicationConfig.path,
      dependencies: this.applicationConfig.dependencies,
      isProduction: this.applicationConfig.isProduction,
      telemetryConfig: this.applicationConfig.telemetry,
      loggerConfig: runtimeConfig.logger,
      metricsConfig,
      serverConfig,
      worker: workerData?.worker,
      resourceLimits: workerData?.resourceLimits,
      hasManagementApi: !!runtimeConfig.managementApi,
      fetchApplicationUrl: fetchApplicationUrl.bind(null, applicationConfig),
      strictEnv: runtimeConfig.strictEnv
    }
  }

  getStatus () {
    if (this.#starting) return 'starting'
    if (this.#started) return 'started'
    return 'stopped'
  }

  async updateContext (context) {
    this.#context = { ...this.#context, ...context }
    if (this.capability) {
      await this.capability.updateContext(context)
    }
  }

  async updateMetricsConfig (metricsConfig) {
    this.#context.metricsConfig = metricsConfig
    if (this.capability && typeof this.capability.updateMetricsConfig === 'function') {
      await this.capability.updateMetricsConfig(metricsConfig)
    }
  }

  // Note: capability's init() is executed within start
  async init (cleanupHandlers) {
    try {
      const appConfig = this.applicationConfig

      if (appConfig.isProduction && !process.env.NODE_ENV) {
        process.env.NODE_ENV = 'production'
      }

      // Before returning the base application, check if there is any file we recognize
      // and the user just forgot to specify in the configuration.
      if (!appConfig.config) {
        const candidate = listRecognizedConfigurationFiles().find(f => existsSync(resolve(appConfig.path, f)))

        if (candidate) {
          appConfig.config = resolve(appConfig.path, candidate)
        }
      }

      if (appConfig.config) {
        // Parse the configuration file the first time to obtain the schema
        const unvalidatedConfig = await loadConfiguration(appConfig.config, null, {
          onMissingEnv: this.#context.fetchApplicationUrl,
          strictEnv: this.#context.strictEnv
        })
        this.#configurePort(unvalidatedConfig.server)
        const pkg = await loadConfigurationModule(appConfig.path, unvalidatedConfig)
        this.capability = await pkg.create(appConfig.path, appConfig.config, this.#context)
        // We could not find a configuration file, we use the bundle @platformatic/basic with the runtime to load it
      } else {
        this.#configurePort()
        const pkg = await loadConfigurationModule(resolve(import.meta.dirname, '../..'), {}, '@platformatic/basic')
        this.capability = await pkg.create(appConfig.path, {}, this.#context)
      }

      this.#updateDispatcher()

      if (cleanupHandlers) {
        cleanupHandlers()
      }

      let exitOnUnhandledErrors = this.runtimeConfig.exitOnUnhandledErrors

      if (exitOnUnhandledErrors === true || typeof exitOnUnhandledErrors === 'undefined') {
        exitOnUnhandledErrors = 100
      }

      if (typeof exitOnUnhandledErrors === 'number' && exitOnUnhandledErrors > 0) {
        this.#setupHandlers(exitOnUnhandledErrors)
      }
    } catch (err) {
      if (err.validationErrors) {
        const logger = getLogger()
        logger.error({ err: ensureLoggableError(err) }, 'The application threw a validation error.')

        throw err
      } else {
        this.#logAndThrow(err)
      }
    }
  }

  async start () {
    if (this.#starting || this.#started) {
      throw new ApplicationAlreadyStartedError()
    }

    this.#starting = true

    try {
      await this.capability.init?.()

      if (this.applicationConfig.exposed !== false && this.#context.serverConfig) {
        this.capability.serverConfig.port = this.#context.serverConfig.port
      }

      this.emit('init')
    } catch (err) {
      this.#logAndThrow(err)
    }

    if (this.capability.status === 'stopped') {
      return
    }

    this.emit('starting')

    if (this.#watch) {
      const watchConfig = await this.capability.getWatchConfig()

      if (watchConfig.enabled !== false) {
        /* c8 ignore next 4 */
        this.#debouncedRestart = debounce(() => {
          this.capability.log({ message: 'files changed', level: 'debug' })
          this.emit('changed')
        }, 100) // debounce restart for 100ms

        this.#startFileWatching(watchConfig)
      }
    }

    try {
      await this.capability.start()
      if (refreshGlobalDispatcher()) {
        this.#updateDispatcher()
      }
      this.#listening = this.applicationConfig.exposed !== false
      /* c8 ignore next 5 */
    } catch (err) {
      this.emit('start:error', err)

      this.capability.log({ message: err.message, level: 'debug' })
      this.#starting = false
      throw err
    }

    this.#started = true
    this.#starting = false

    this.emit('started')
  }

  getUrl () {
    return this.capability.getUrl()
  }

  async stop (force = false, dependents = []) {
    if (!force && (!this.#started || this.#starting)) {
      throw new RuntimeNotStartedError()
    }

    this.emit('stopping')

    await this.#stopFileWatching()
    await this.capability.waitForDependentsStop(dependents)
    await this.capability.stop()

    this.#started = false
    this.#starting = false
    this.#listening = false

    this.emit('stopped')
  }

  async getMetrics ({ format }) {
    const dispatcher = getGlobalDispatcher()
    const onHttpStatsFree = getOnHttpStatsFree({ throwOnMissing: false })

    if (onHttpStatsFree && dispatcher?.stats) {
      // The capability might come from an older version of @platformatic/basic
      // which registered these globals without the fields tracking, so never throw.
      const onHttpStatsConnected = getOnHttpStatsConnected({ throwOnMissing: false })
      const onHttpStatsPending = getOnHttpStatsPending({ throwOnMissing: false })
      const onHttpStatsQueued = getOnHttpStatsQueued({ throwOnMissing: false })
      const onHttpStatsRunning = getOnHttpStatsRunning({ throwOnMissing: false })
      const onHttpStatsSize = getOnHttpStatsSize({ throwOnMissing: false })

      for (const url in dispatcher.stats) {
        const { free, connected, pending, queued, running, size } = dispatcher.stats[url]
        onHttpStatsFree(url, free || 0)
        onHttpStatsConnected?.(url, connected || 0)
        onHttpStatsPending?.(url, pending || 0)
        onHttpStatsQueued?.(url, queued || 0)
        onHttpStatsRunning?.(url, running || 0)
        onHttpStatsSize?.(url, size || 0)
      }
    }
    const onActiveResourcesEventLoop = getOnActiveResourcesEventLoop({ throwOnMissing: false })
    if (onActiveResourcesEventLoop) {
      onActiveResourcesEventLoop(getActiveResourcesInfo().length)
    }
    return this.capability.getMetrics({ format })
  }

  async getHealth () {
    const currentELU = performance.eventLoopUtilization()
    const { heapUsed, heapTotal } = process.memoryUsage()

    return {
      currentELU,
      heapUsed,
      heapTotal
    }
  }

  #startFileWatching (watch) {
    if (this.#fileWatcher) {
      return
    }

    const fileWatcher = new FileWatcher({
      path: watch.path,
      /* c8 ignore next 2 */
      allowToWatch: watch?.allow,
      watchIgnore: watch?.ignore || []
    })

    fileWatcher.on('update', this.#debouncedRestart)

    fileWatcher.startWatching()
    this.capability.log({ message: 'start watching files', level: 'debug' })
    this.#fileWatcher = fileWatcher
  }

  async #stopFileWatching () {
    const watcher = this.#fileWatcher

    if (watcher) {
      this.capability.log({ message: 'stop watching files', level: 'debug' })
      await watcher.stopWatching()
      this.#fileWatcher = null
    }
  }

  #logAndThrow (err) {
    const logger = getLogger()
    logger.error(
      { err: ensureLoggableError(err) },
      err[kHandledError] ? err.message : 'The application threw an error.'
    )

    throw err
  }

  #updateDispatcher () {
    const telemetryConfig = this.#context.telemetryConfig
    const telemetryId = telemetryConfig?.applicationName

    const interceptor = dispatch => {
      return function InterceptedDispatch (opts, handler) {
        if (telemetryId) {
          opts.headers = {
            ...opts.headers,
            'x-plt-telemetry-id': telemetryId
          }
        }
        return dispatch(opts, handler)
      }
    }

    const dispatcher = getGlobalDispatcher().compose(interceptor)

    markAsPlatformaticDispatcher(dispatcher)
    setGlobalDispatcher(dispatcher)
    mirrorGlobalDispatcherForBuiltinFetch(dispatcher)
  }

  #setupHandlers (timeout) {
    const unhandledListeners = { uncaughtException: [], unhandledRejection: [] }

    process.on(
      'uncaughtException',
      handleUnhandled.bind(null, this, 'uncaughtException', unhandledListeners.uncaughtException, timeout)
    )
    process.on(
      'unhandledRejection',
      handleUnhandled.bind(null, this, 'unhandledRejection', unhandledListeners.unhandledRejection, timeout)
    )

    process.on('newListener', (event, listener) => {
      if (event === 'uncaughtException' || event === 'unhandledRejection') {
        unhandledListeners[event].push(listener)

        process.nextTick(() => {
          process.removeListener(event, listener)
        })
      }
    })
  }

  #configurePort (serverConfig) {
    if (this.applicationConfig.exposed === false || !workerData?.worker || !this.#context.serverConfig) {
      return
    }

    const effectiveServerConfig = { ...this.#context.serverConfig, ...serverConfig }
    const portEnv = this.applicationConfig.portEnv ?? 'PORT'
    const configuredPort = Number(workerData.worker.portOverride ?? effectiveServerConfig.port)
    const environmentPort = Number(process.env[portEnv])
    const basePort =
      Number.isInteger(configuredPort) && configuredPort > 0
        ? configuredPort
        : Number.isInteger(environmentPort) && environmentPort >= 0
          ? environmentPort
          : Number.isInteger(configuredPort) && configuredPort >= 0
            ? configuredPort
            : 0
    if (effectiveServerConfig.portAssignment === 'perWorkerIncrement' && basePort <= 0) {
      throw new InvalidArgumentError(
        `server.port or ${portEnv} must be a positive port when server.portAssignment is "perWorkerIncrement"`
      )
    }

    const port = effectiveServerConfig.portAssignment === 'perWorkerIncrement' ? basePort + workerData.worker.portOffset : basePort

    if (port > 65535) {
      throw new InvalidArgumentError('server.portAssignment "perWorkerIncrement" exceeds the maximum TCP port')
    }

    process.env[portEnv] = String(port)
    this.#context.serverConfig = { ...effectiveServerConfig, port }
  }
}
