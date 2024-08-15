'use strict'

const { EventEmitter } = require('node:events')
const { FileWatcher } = require('@platformatic/utils')
const { getGlobalDispatcher, setGlobalDispatcher } = require('undici')
const debounce = require('debounce')

const errors = require('../errors')
const defaultStackable = require('./default-stackable')
const { getServiceUrl, loadConfig, loadEmptyConfig } = require('../utils')

class PlatformaticApp extends EventEmitter {
  #starting
  #started
  #listening
  #watch
  #fileWatcher
  #debouncedRestart
  #context

  constructor (appConfig, telemetryConfig, serverConfig, hasManagementApi, watch, metricsConfig) {
    super()
    this.appConfig = appConfig
    this.#watch = watch
    this.#starting = false
    this.#started = false
    this.#listening = false
    this.stackable = null
    this.#fileWatcher = null

    this.#context = {
      serviceId: this.appConfig.id,
      directory: this.appConfig.path,
      isEntrypoint: this.appConfig.entrypoint,
      isProduction: false,
      telemetryConfig,
      metricsConfig,
      serverConfig,
      hasManagementApi: !!hasManagementApi,
      localServiceEnvVars: this.appConfig.localServiceEnvVars,
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
      this.stackable.updateContext(context)
    }
  }

  async getBootstrapDependencies () {
    return this.stackable.getBootstrapDependencies()
  }

  async init () {
    try {
      const appConfig = this.appConfig
      let loadedConfig

      if (!appConfig.config) {
        loadedConfig = await loadEmptyConfig(
          appConfig.path,
          {
            onMissingEnv: this.#fetchServiceUrl,
            context: appConfig,
          },
          true
        )
      } else {
        loadedConfig = await loadConfig(
          {},
          ['-c', appConfig.config],
          {
            onMissingEnv: this.#fetchServiceUrl,
            context: appConfig,
          },
          true
        )
      }

      const app = loadedConfig.app

      const stackable = await app.buildStackable({
        onMissingEnv: this.#fetchServiceUrl,
        config: this.appConfig.config,
        context: this.#context,
      })
      this.stackable = this.#wrapStackable(stackable)

      this.#updateDispatcher()
    } catch (err) {
      this.#logAndExit(err)
    }
  }

  async start () {
    if (this.#starting || this.#started) {
      throw new errors.ApplicationAlreadyStartedError()
    }

    this.#starting = true

    try {
      await this.stackable.init()
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

  #fetchServiceUrl (key, { parent, context: service }) {
    if (service.localServiceEnvVars.has(key)) {
      return service.localServiceEnvVars.get(key)
    } else if (!key.endsWith('_URL') || !parent.serviceId) {
      return null
    }

    return getServiceUrl(parent.serviceId)
  }

  #startFileWatching (watch) {
    if (this.#fileWatcher) {
      return
    }

    const fileWatcher = new FileWatcher({
      path: watch.path,
      /* c8 ignore next 2 */
      allowToWatch: watch?.allow,
      watchIgnore: watch?.ignore || [],
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
    // Runtime logs here with console.error because stackable is not initialized
    console.error(
      JSON.stringify({
        msg: err.message,
        name: this.appConfig.id,
      })
    )
    process.exit(1)
  }

  #wrapStackable (stackable) {
    const newStackable = {}
    for (const method of Object.keys(defaultStackable)) {
      newStackable[method] = stackable[method]
        ? stackable[method].bind(stackable)
        : defaultStackable[method]
    }
    return newStackable
  }

  #updateDispatcher () {
    const telemetryConfig = this.#context.telemetryConfig
    const telemetryId = telemetryConfig?.serviceName

    const interceptor = dispatch => {
      return function InterceptedDispatch (opts, handler) {
        if (telemetryId) {
          opts.headers = {
            ...opts.headers,
            'x-platformatic-telemetry-id': telemetryId,
          }
        }
        return dispatch(opts, handler)
      }
    }

    const dispatcher = getGlobalDispatcher()
      .compose(interceptor)

    setGlobalDispatcher(dispatcher)
  }
}

module.exports = { PlatformaticApp }
