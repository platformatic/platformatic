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
const { getApplicationUrl } = require('../utils')

function fetchApplicationUrl (application, key) {
  if (!key.endsWith('_URL') || !application.id) {
    return null
  }

  return getApplicationUrl(application.id)
}

class Controller extends EventEmitter {
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
    this.applicationId = this.appConfig.id
    this.workerId = workerId
    this.#watch = watch
    this.#starting = false
    this.#started = false
    this.#listening = false
    this.capability = null
    this.#fileWatcher = null
    this.#lastELU = eventLoopUtilization()

    this.#context = {
      applicationId: this.applicationId,
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
      fetchApplicationUrl: fetchApplicationUrl.bind(null, appConfig)
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

  async getBootstrapDependencies () {
    return this.capability.getBootstrapDependencies?.() ?? []
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
          onMissingEnv: this.#context.fetchApplicationUrl
        })
        const pkg = await loadConfigurationModule(appConfig.path, unvalidatedConfig)
        this.capability = await pkg.create(appConfig.path, appConfig.config, this.#context)
        // We could not find a configuration file, we use the bundle @platformatic/basic with the runtime to load it
      } else {
        const pkg = await loadConfigurationModule(resolve(__dirname, '../..'), {}, '@platformatic/basic')
        this.capability = await pkg.create(appConfig.path, {}, this.#context)
      }

      this.#updateDispatcher()
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
      throw new errors.ApplicationAlreadyStartedError()
    }

    this.#starting = true

    try {
      await this.capability.init?.()
    } catch (err) {
      this.#logAndThrow(err)
    }

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

    const listen = !!this.appConfig.useHttp

    try {
      await this.capability.start({ listen })
      this.#listening = listen
      /* c8 ignore next 5 */
    } catch (err) {
      this.capability.log({ message: err.message, level: 'debug' })
      this.#starting = false
      throw err
    }

    this.#started = true
    this.#starting = false
    this.emit('start')
  }

  async stop (force = false) {
    if (!force && (!this.#started || this.#starting)) {
      throw new errors.RuntimeNotStartedError()
    }

    await this.#stopFileWatching()
    await this.capability.stop()

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
    return this.capability.getMetrics({ format })
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
    globalThis.platformatic.logger.error({ err: ensureLoggableError(err) }, 'The application threw an error.')
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
}

module.exports = { Controller }
