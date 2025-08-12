'use strict'

const { existsSync } = require('node:fs')
const { EventEmitter } = require('node:events')
const { resolve } = require('node:path')
const {
  performance: { eventLoopUtilization }
} = require('node:perf_hooks')
const { workerData } = require('node:worker_threads')
const {
  FileWatcher,
  listRecognizedConfigurationFiles,
  loadConfigurationModule,
  loadConfiguration,
  ensureLoggableError
} = require('@platformatic/foundation')
const { getGlobalDispatcher, setGlobalDispatcher } = require('undici')
const debounce = require('debounce')

const errors = require('../errors')
const { getServiceUrl } = require('../utils')

function fetchServiceUrl (service, key) {
  if (service.localServiceEnvVars.has(key)) {
    return service.localServiceEnvVars.get(key)
  } else if (!key.endsWith('_URL') || !service.id) {
    return null
  }

  return getServiceUrl(service.id)
}

class PlatformaticApp extends EventEmitter {
  #starting
  #started
  #listening
  #watch
  #fileWatcher
  #debouncedRestart
  #context
  #lastELU

  constructor (
    appConfig,
    workerId,
    telemetryConfig,
    loggerConfig,
    serverConfig,
    metricsConfig,
    hasManagementApi,
    watch
  ) {
    super()
    this.appConfig = appConfig
    this.serviceId = this.appConfig.id
    this.workerId = workerId
    this.#watch = watch
    this.#starting = false
    this.#started = false
    this.#listening = false
    this.stackable = null
    this.#fileWatcher = null
    this.#lastELU = eventLoopUtilization()

    this.#context = {
      serviceId: this.serviceId,
      workerId: this.workerId,
      directory: this.appConfig.path,
      isEntrypoint: this.appConfig.entrypoint,
      isProduction: this.appConfig.isProduction,
      telemetryConfig,
      metricsConfig,
      loggerConfig,
      serverConfig,
      worker: workerData?.worker,
      hasManagementApi: !!hasManagementApi,
      localServiceEnvVars: this.appConfig.localServiceEnvVars,
      fetchServiceUrl: fetchServiceUrl.bind(null, appConfig)
    }
  }

  getStatus () {
    if (this.#starting) return 'starting'
    if (this.#started) return 'started'
    return 'stopped'
  }

  async updateContext (context) {
    this.#context = { ...this.#context, ...context }
    if (this.stackable) {
      await this.stackable.updateContext(context)
    }
  }

  async getBootstrapDependencies () {
    return this.stackable.getBootstrapDependencies?.() ?? []
  }

  async init () {
    try {
      const appConfig = this.appConfig

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
          onMissingEnv: this.#context.fetchServiceUrl
        })
        const pkg = await loadConfigurationModule(appConfig.path, unvalidatedConfig)
        this.stackable = await pkg.create(appConfig.path, appConfig.config, this.#context)
        // We could not find a configuration file, we use the bundle @platformatic/basic with the runtime to load it
      } else {
        const pkg = await loadConfigurationModule(resolve(__dirname, '../..'), {}, '@platformatic/basic')
        this.stackable = await pkg.create(appConfig.path, {}, this.#context)
      }

      this.#updateDispatcher()
    } catch (err) {
      if (err.validationErrors) {
        globalThis.platformatic.logger.error(
          { err: ensureLoggableError(err.validationErrors) },
          'The application threw a validation error.'
        )

        process.exit(1)
      } else {
        this.#logAndExit(err)
      }
    }
  }

  async start () {
    if (this.#starting || this.#started) {
      throw new errors.ApplicationAlreadyStartedError()
    }

    this.#starting = true

    try {
      await this.stackable.init?.()
    } catch (err) {
      this.#logAndExit(err)
    }

    if (this.#watch) {
      const watchConfig = await this.stackable.getWatchConfig()

      if (watchConfig.enabled !== false) {
        /* c8 ignore next 4 */
        this.#debouncedRestart = debounce(() => {
          this.stackable.log({ message: 'files changed', level: 'debug' })
          this.emit('changed')
        }, 100) // debounce restart for 100ms

        this.#startFileWatching(watchConfig)
      }
    }

    const listen = !!this.appConfig.useHttp

    try {
      await this.stackable.start({ listen })
      this.#listening = listen
      /* c8 ignore next 5 */
    } catch (err) {
      this.stackable.log({ message: err.message, level: 'debug' })
      this.#starting = false
      throw err
    }

    this.#started = true
    this.#starting = false
    this.emit('start')
  }

  async stop () {
    if (!this.#started || this.#starting) {
      throw new errors.ApplicationNotStartedError()
    }

    await this.#stopFileWatching()
    await this.stackable.stop()

    this.#started = false
    this.#starting = false
    this.#listening = false
    this.emit('stop')
  }

  async listen () {
    // This server is not an entrypoint or already listened in start. Behave as no-op.
    if (!this.appConfig.entrypoint || this.appConfig.useHttp || this.#listening) {
      return
    }

    await this.stackable.start({ listen: true })
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
    return this.stackable.getMetrics({ format })
  }

  async getHealth () {
    const currentELU = eventLoopUtilization()
    const elu = eventLoopUtilization(currentELU, this.#lastELU).utilization
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
    this.stackable.log({ message: 'start watching files', level: 'debug' })
    this.#fileWatcher = fileWatcher
  }

  async #stopFileWatching () {
    const watcher = this.#fileWatcher

    if (watcher) {
      this.stackable.log({ message: 'stop watching files', level: 'debug' })
      await watcher.stopWatching()
      this.#fileWatcher = null
    }
  }

  #logAndExit (err) {
    globalThis.platformatic.logger.error({ err: ensureLoggableError(err) }, 'The application threw an error.')
    process.exit(1)
  }

  #updateDispatcher () {
    const telemetryConfig = this.#context.telemetryConfig
    const telemetryId = telemetryConfig?.serviceName

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
}

module.exports = { PlatformaticApp }
