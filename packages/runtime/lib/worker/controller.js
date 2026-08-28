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
import { importCapabilityPackage } from '@platformatic/basic'
import debounce from 'debounce'
import { EventEmitter } from 'node:events'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { getActiveResourcesInfo } from 'node:process'
import { workerData } from 'node:worker_threads'
import { getGlobalDispatcher, setGlobalDispatcher } from 'undici'
import { ApplicationAlreadyStartedError, exitCodes, RuntimeNotStartedError } from '../errors.js'
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
  setTimeout(() => process.exit(exitCodes.PROCESS_UNHANDLED_ERROR), timeout)

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
  #watch
  #fileWatcher
  #debouncedRestart
  #context

  constructor (runtimeConfig, applicationConfig, workerId, metricsConfig) {
    super()
    this.runtimeConfig = runtimeConfig
    this.applicationConfig = applicationConfig
    this.applicationId = this.applicationConfig.id
    this.workerId = workerId
    this.#watch = !!runtimeConfig.watch
    this.#starting = false
    this.#started = false
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

      /*
        v4: the configuration was evaluated exactly once, main-side, and this worker receives the
        validated capability payload as data. There is no file to re-read and no schema to
        rediscover — which is the whole point, since re-parsing per worker meant an application
        with workers: 4 evaluated user code five times and could reach five different answers.

        The capability is imported through the canonical resolution order, application-scoped first,
        so the copy that runs here is the copy whose schema validated the payload main-side.
      */
      /*
        v4: the configuration was evaluated exactly once, main-side, and this worker receives the
        validated capability payload as data. There is no file to re-read and no schema to
        rediscover — which is the point, since re-parsing per worker meant an application with
        workers: 4 evaluated user code five times and could reach five different answers.

        The capability is imported through the canonical resolution order, application-scoped
        first, so the copy that runs here is the copy whose schema validated the payload.
      */
      if (appConfig.resolvedConfig) {
        const pkg = await importCapabilityPackage(appConfig.path, appConfig.module)

        /*
          `resolved` says the configuration needs none of v3's reading: the loader layered its
          environment main-side, there are no placeholders in it, and it has already been validated
          against this capability's schema. Without it the capability re-runs that machinery here
          and puts `PLT_ROOT` -- a variable v4 removed -- back into what the application reports.
        */
        this.capability = await pkg.create(appConfig.path, appConfig.resolvedConfig, {
          ...this.#context,
          resolved: true
        })
      } else {
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
          const pkg = await loadConfigurationModule(appConfig.path, unvalidatedConfig)
          this.capability = await pkg.create(appConfig.path, appConfig.config, this.#context)
          // We could not find a configuration file, we use the bundle @platformatic/basic with the runtime to load it
        } else {
          const pkg = await loadConfigurationModule(resolve(import.meta.dirname, '../..'), {}, '@platformatic/basic')
          this.capability = await pkg.create(appConfig.path, {}, this.#context)
        }
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
}
