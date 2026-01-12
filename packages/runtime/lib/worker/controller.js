import {
  ensureLoggableError,
  executeWithTimeout,
  FileWatcher,
  kHandledError,
  listRecognizedConfigurationFiles,
  loadConfiguration,
  loadConfigurationModule
} from '@platformatic/foundation'
import debounce from 'debounce'
import { EventEmitter } from 'node:events'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { getActiveResourcesInfo } from 'node:process'
import { workerData } from 'node:worker_threads'
import { getGlobalDispatcher, setGlobalDispatcher } from 'undici'
import { ApplicationAlreadyStartedError, RuntimeNotStartedError } from '../errors.js'
import { getApplicationUrl } from '../utils.js'

function fetchApplicationUrl (application, key) {
  if (!key.endsWith('_URL') || !application.id) {
    return null
  }

  return getApplicationUrl(application.id)
}

function handleUnhandled (app, type, err) {
  const label = `worker ${workerData.worker.index} of the application "${workerData.applicationConfig.id}"`

  globalThis.platformatic.logger.error({ err: ensureLoggableError(err) }, `The ${label} threw an ${type}.`)

  executeWithTimeout(app?.stop(), 1000)
    .catch()
    .finally(() => {
      process.exit(1)
    })
}

export class Controller extends EventEmitter {
  #starting
  #started
  #listening
  #watch
  #fileWatcher
  #debouncedRestart
  #context
  #lastELU

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
    this.#lastELU = performance.eventLoopUtilization()

    this.#context = {
      controller: this,
      applicationId: this.applicationId,
      workerId: this.workerId,
      directory: this.applicationConfig.path,
      dependencies: this.applicationConfig.dependencies,
      isEntrypoint: this.applicationConfig.entrypoint,
      isProduction: this.applicationConfig.isProduction,
      telemetryConfig: this.applicationConfig.telemetry,
      loggerConfig: runtimeConfig.logger,
      metricsConfig,
      serverConfig,
      worker: workerData?.worker,
      hasManagementApi: !!runtimeConfig.managementApi,
      fetchApplicationUrl: fetchApplicationUrl.bind(null, applicationConfig)
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
  async init () {
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
          onMissingEnv: this.#context.fetchApplicationUrl
        })
        const pkg = await loadConfigurationModule(appConfig.path, unvalidatedConfig)
        this.capability = await pkg.create(appConfig.path, appConfig.config, this.#context)
        // We could not find a configuration file, we use the bundle @platformatic/basic with the runtime to load it
      } else {
        const pkg = await loadConfigurationModule(resolve(import.meta.dirname, '../..'), {}, '@platformatic/basic')
        this.capability = await pkg.create(appConfig.path, {}, this.#context)
      }

      this.#updateDispatcher()

      if (this.capability.exitOnUnhandledErrors && this.runtimeConfig.exitOnUnhandledErrors) {
        this.#setupHandlers()
      }
    } catch (err) {
      if (err.validationErrors) {
        globalThis.platformatic.logger.error(
          { err: ensureLoggableError(err) },
          'The application threw a validation error.'
        )

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

    this.#updateCapabilityStatus('starting')
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

    const listen = !!this.applicationConfig.useHttp

    try {
      await this.capability.start({ listen })
      this.#listening = listen
      /* c8 ignore next 5 */
    } catch (err) {
      this.#updateCapabilityStatus('start:error')
      this.emit('start:error', err)

      this.capability.log({ message: err.message, level: 'debug' })
      this.#starting = false
      throw err
    }

    this.#started = true
    this.#starting = false

    this.#updateCapabilityStatus('started')
    this.emit('started')
  }

  async stop (force = false, dependents = []) {
    if (!force && (!this.#started || this.#starting)) {
      throw new RuntimeNotStartedError()
    }

    this.emit('stopping')
    // Do not update status of the capability to "stopping" here otherwise
    // if stop is called before start is finished, the capability will not
    // be able to wait for start to finish and it will create a race condition.

    await this.#stopFileWatching()
    await this.capability.waitForDependentsStop(dependents)
    await this.capability.stop()

    this.#started = false
    this.#starting = false
    this.#listening = false

    this.#updateCapabilityStatus('stopped')
    this.emit('stopped')
  }

  async listen () {
    // This server is not an entrypoint or already listened in start. Behave as no-op.
    if (!this.applicationConfig.entrypoint || this.applicationConfig.useHttp || this.#listening) {
      return
    }

    await this.capability.start({ listen: true })
  }

  async getMetrics ({ format }) {
    const dispatcher = getGlobalDispatcher()
    if (globalThis.platformatic?.onHttpStatsFree && dispatcher?.stats) {
      for (const url in dispatcher.stats) {
        const { free, connected, pending, queued, running, size } = dispatcher.stats[url]
        globalThis.platformatic.onHttpStatsFree(url, free || 0)
        globalThis.platformatic.onHttpStatsConnected(url, connected || 0)
        globalThis.platformatic.onHttpStatsPending(url, pending || 0)
        globalThis.platformatic.onHttpStatsQueued(url, queued || 0)
        globalThis.platformatic.onHttpStatsRunning(url, running || 0)
        globalThis.platformatic.onHttpStatsSize(url, size || 0)
      }
    }
    globalThis.platformatic.onActiveResourcesEventLoop(getActiveResourcesInfo().length)
    return this.capability.getMetrics({ format })
  }

  async getHealth () {
    const currentELU = performance.eventLoopUtilization()
    const elu = performance.eventLoopUtilization(currentELU, this.#lastELU).utilization
    this.#lastELU = currentELU

    const { heapUsed, heapTotal } = process.memoryUsage()

    return {
      elu,
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
    globalThis.platformatic.logger.error(
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

    setGlobalDispatcher(dispatcher)
  }

  #setupHandlers () {
    process.on('uncaughtException', handleUnhandled.bind(null, this, 'uncaught exception'))
    process.on('unhandledRejection', handleUnhandled.bind(null, this, 'unhandled rejection'))

    process.on('newListener', event => {
      if (event === 'uncaughtException' || event === 'unhandledRejection') {
        globalThis.platformatic.logger.warn(
          `A listener has been added for the "process.${event}" event. This listener will be never triggered as Watt default behavior will kill the process before.\n To disable this behavior, set "exitOnUnhandledErrors" to false in the runtime config.`
        )
      }
    })
  }

  #updateCapabilityStatus (status) {
    if (typeof this.capability.updateStatus === 'function') {
      this.capability.updateStatus(status)
    } else {
      // This is horrible but needed for backward compatibility
      this.capability.status = status
      this.capability.emit(status)
    }
  }
}
