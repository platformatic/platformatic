'use strict'

const { EventEmitter } = require('node:events')
const { dirname } = require('node:path')

const { FileWatcher } = require('@platformatic/utils')
const debounce = require('debounce')

const errors = require('../errors')
const { getServiceUrl, loadConfig } = require('../utils')

class PlatformaticApp extends EventEmitter {
  #starting
  #started
  #listening
  #watch
  #fileWatcher
  #logger
  #telemetryConfig
  #serverConfig
  #debouncedRestart
  #hasManagementApi
  #metricsConfig

  constructor (appConfig, logger, telemetryConfig, serverConfig, hasManagementApi, watch, metricsConfig) {
    super()
    this.appConfig = appConfig

    this.configManager = null
    this.buildStackable = null

    this.#watch = watch
    this.#starting = false
    this.#started = false
    this.#listening = false
    this.stackable = null
    this.#fileWatcher = null
    this.#hasManagementApi = !!hasManagementApi
    this.#logger = logger.child({
      name: this.appConfig.id,
    })
    this.#telemetryConfig = telemetryConfig
    this.#metricsConfig = metricsConfig
    this.#serverConfig = serverConfig
  }

  getStatus () {
    if (this.#starting) return 'starting'
    if (this.#started) return 'started'
    return 'stopped'
  }

  async getBootstrapDependencies () {
    return this.stackable.getBootstrapDependencies()
  }

  async init () {
    await this.#loadConfig()

    try {
      // If this is a restart, have the fastify server restart itself. If this
      // is not a restart, then create a new server.
      const { stackable, configManager } = await this.buildStackable({
        onMissingEnv: this.#fetchServiceUrl,
        config: this.appConfig.config,
        context: {
          serviceId: this.appConfig.id,
          isEntrypoint: this.appConfig.entrypoint,
          telemetryConfig: this.#telemetryConfig,
          metricsConfig: this.#metricsConfig,
          serverConfig: this.#serverConfig,
          hasManagementApi: this.#hasManagementApi,
          localServiceEnvVars: this.appConfig.localServiceEnvVars,
        },
      })
      this.stackable = stackable
      this.configManager = configManager
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

    const config = this.configManager.current

    const watch = config.watch

    if (config.plugins !== undefined && this.#watch && watch.enabled !== false) {
      /* c8 ignore next 4 */
      this.#debouncedRestart = debounce(() => {
        this.stackable.log({ message: 'files changed', level: 'debug' })
        this.emit('changed')
      }, 100) // debounce restart for 100ms

      this.#startFileWatching(watch)
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

  async #loadConfig () {
    const appConfig = this.appConfig

    let _config
    try {
      _config = await loadConfig({}, ['-c', appConfig.config], {
        onMissingEnv: this.#fetchServiceUrl,
        context: appConfig,
      }, true)
    } catch (err) {
      this.#logAndExit(err)
    }

    this.buildStackable = _config.app.buildStackable
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
    const configManager = this.configManager
    const fileWatcher = new FileWatcher({
      path: dirname(configManager.fullPath),
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
    this.#logger.error({ err })
    process.exit(1)
  }
}

module.exports = { PlatformaticApp }
