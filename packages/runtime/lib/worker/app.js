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
    this.config = null
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
    await this.#loadConfig()
    const resolver = this.config.app.getBootstrapDependencies
    if (typeof resolver === 'function') {
      return resolver(this.appConfig, this.config.configManager)
    }
    return []
  }

  async init () {
    await this.#applyConfig()

    const configManager = this.config.configManager
    const config = configManager.current

    this.#setupLogger(configManager)

    try {
      // If this is a restart, have the fastify server restart itself. If this
      // is not a restart, then create a new server.
      const { stackable } = await this.config.app.buildStackable({
        app: this.config.app,
        ...config,
        id: this.appConfig.id,
        configManager,
      })
      this.stackable = stackable
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

    const configManager = this.config.configManager
    const config = configManager.current

    const watch = this.config.configManager.current.watch

    if (config.plugins !== undefined && this.#watch && watch.enabled !== false) {
      /* c8 ignore next 4 */
      this.#debouncedRestart = debounce(() => {
        this.stackable.log('files changed', { level: 'debug' })
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
      this.stackable.log(err, { level: 'debug' })
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

    this.config = _config
  }

  async #applyConfig () {
    if (!this.config) {
      await this.#loadConfig()
    }

    const appConfig = this.appConfig
    const { configManager } = this.config

    configManager.on('error', (err) => {
      /* c8 ignore next */
      this.stackable.log('error reloading the configuration' + err, { level: 'error' })
    })

    if (appConfig._configOverrides instanceof Map) {
      appConfig._configOverrides.forEach((value, key) => {
        if (typeof key !== 'string') {
          throw new errors.ConfigPathMustBeStringError()
        }

        const parts = key.split('.')
        let next = configManager.current
        let obj
        let i

        for (i = 0; next !== undefined && i < parts.length; ++i) {
          obj = next
          next = obj[parts[i]]
        }

        if (i === parts.length) {
          obj[parts.at(-1)] = value
        }
      })
    }

    configManager.update({
      ...configManager.current,
      telemetry: this.#telemetryConfig,
      metrics: this.#metricsConfig,
    })

    if (this.#serverConfig) {
      configManager.update({
        ...configManager.current,
        server: this.#serverConfig,
      })
    }

    if (
      (this.#hasManagementApi && configManager.current.metrics === undefined) ||
      configManager.current.metrics
    ) {
      const labels = configManager.current.metrics?.labels || {}
      const serviceId = this.appConfig.id
      configManager.update({
        ...configManager.current,
        metrics: {
          server: 'hide',
          defaultMetrics: { enabled: this.appConfig.entrypoint },
          ...configManager.current.metrics,
          labels: {
            serviceId,
            ...labels,
          },
        },
      })
    }

    if (!this.appConfig.entrypoint) {
      configManager.update({
        ...configManager.current,
        server: {
          ...(configManager.current.server || {}),
          trustProxy: true,
        },
      })
    }
  }

  #setupLogger (configManager) {
    configManager.current.server = configManager.current.server || {}
    const level = configManager.current.server.logger?.level

    configManager.current.server.logger = level
      ? this.#logger.child({ level })
      : this.#logger
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
    const { configManager } = this.config
    const fileWatcher = new FileWatcher({
      path: dirname(configManager.fullPath),
      /* c8 ignore next 2 */
      allowToWatch: watch?.allow,
      watchIgnore: watch?.ignore || [],
    })

    fileWatcher.on('update', this.#debouncedRestart)

    fileWatcher.startWatching()
    this.stackable.log('start watching files', { level: 'debug' })
    this.#fileWatcher = fileWatcher
  }

  async #stopFileWatching () {
    const watcher = this.#fileWatcher

    if (watcher) {
      this.stackable.log('stop watching files', { level: 'debug' })
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
