'use strict'

const { EventEmitter } = require('node:events')
const { dirname } = require('node:path')

const { FileWatcher } = require('@platformatic/utils')
const debounce = require('debounce')

const { buildServer } = require('../build-server')
const errors = require('../errors')
const { getServiceUrl, loadConfig } = require('../utils')

class PlatformaticApp extends EventEmitter {
  #starting
  #started
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
    this.server = null
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

  async start () {
    if (this.#starting || this.#started) {
      throw new errors.ApplicationAlreadyStartedError()
    }

    this.#starting = true

    await this.#applyConfig()

    const configManager = this.config.configManager
    const config = configManager.current

    this.#setupLogger(configManager)

    try {
      // If this is a restart, have the fastify server restart itself. If this
      // is not a restart, then create a new server.
      this.server = await buildServer({
        app: this.config.app,
        ...config,
        id: this.appConfig.id,
        configManager,
      })
    } catch (err) {
      this.#logAndExit(err)
    }

    const watch = this.config.configManager.current.watch

    if (config.plugins !== undefined && this.#watch && watch.enabled !== false) {
      /* c8 ignore next 4 */
      this.#debouncedRestart = debounce(() => {
        this.server.log.info('files changed')
        this.emit('changed')
      }, 100) // debounce restart for 100ms

      this.#startFileWatching(watch)
    }

    if (this.appConfig.useHttp) {
      try {
        await this.server.start()
        /* c8 ignore next 5 */
      } catch (err) {
        this.server.log.error({ err })
        this.#starting = false
        throw err
      }
    } else {
      // Make sure the server has run all the onReady hooks before returning.
      await this.server.ready()
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
    await this.server.close()

    this.#started = false
    this.#starting = false
    this.emit('stop')
  }

  async listen () {
    // This server is not an entrypoint or already listened in start. Behave as no-op.
    if (!this.appConfig.entrypoint || this.appConfig.useHttp) {
      return
    }

    await this.server.start()
  }

  async #loadConfig () {
    const appConfig = this.appConfig

    let _config
    try {
      _config = await loadConfig({}, ['-c', appConfig.config], {
        onMissingEnv: this.#fetchServiceUrl,
        context: appConfig,
      }, true, this.#logger)
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
      this.server.log.error({ err }, 'error reloading the configuration')
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
    const server = this.server
    const { configManager } = server.platformatic
    const fileWatcher = new FileWatcher({
      path: dirname(configManager.fullPath),
      /* c8 ignore next 2 */
      allowToWatch: watch?.allow,
      watchIgnore: watch?.ignore || [],
    })

    fileWatcher.on('update', this.#debouncedRestart)

    fileWatcher.startWatching()
    server.log.debug('start watching files')
    server.platformatic.fileWatcher = fileWatcher
    this.#fileWatcher = fileWatcher
  }

  async #stopFileWatching () {
    const watcher = this.#fileWatcher

    if (watcher) {
      this.server.log.debug('stop watching files')
      await watcher.stopWatching()
      this.server.platformatic.fileWatcher = undefined
      this.#fileWatcher = null
    }
  }

  #logAndExit (err) {
    this.#logger.error({ err })
    process.exit(1)
  }
}

module.exports = { PlatformaticApp }
