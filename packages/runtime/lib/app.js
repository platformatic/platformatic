'use strict'

const { dirname } = require('node:path')
const { EventEmitter, once } = require('node:events')
const { FileWatcher } = require('@platformatic/utils')
const debounce = require('debounce')
const { snakeCase } = require('change-case-all')
const { buildServer } = require('./build-server')
const { loadConfig } = require('./load-config')
const errors = require('./errors')

class PlatformaticApp extends EventEmitter {
  #hotReload
  #loaderPort
  #starting
  #started
  #originalWatch
  #fileWatcher
  #logger
  #telemetryConfig
  #serverConfig
  #debouncedRestart
  #hasManagementApi

  constructor (appConfig, loaderPort, logger, telemetryConfig, serverConfig, hasManagementApi) {
    super()
    this.appConfig = appConfig
    this.config = null
    this.#hotReload = false
    this.#loaderPort = loaderPort
    this.#starting = false
    this.#started = false
    this.server = null
    this.#originalWatch = null
    this.#fileWatcher = null
    this.#hasManagementApi = !!hasManagementApi
    this.#logger = logger.child({
      name: this.appConfig.id
    })
    this.#telemetryConfig = telemetryConfig
    this.#serverConfig = serverConfig

    /* c8 ignore next 4 */
    this.#debouncedRestart = debounce(() => {
      this.server.log.info('files changed')
      this.restart()
    }, 100) // debounce restart for 100ms
  }

  getStatus () {
    if (this.#starting) return 'starting'
    if (this.#started) return 'started'
    return 'stopped'
  }

  async restart (force) {
    if (this.#starting || !this.#started || (!this.#hotReload && !force)) {
      return
    }

    this.#starting = true
    this.#started = false

    // The CJS cache should not be cleared from the loader because v20 moved
    // the loader to a different thread with a different CJS cache.
    clearCjsCache()

    /* c8 ignore next 4 - tests may not pass in a MessagePort. */
    if (this.#loaderPort) {
      this.#loaderPort.postMessage('plt:clear-cache')
      await once(this.#loaderPort, 'message')
    }

    try {
      await this.config.configManager.parseAndValidate()
      await this.#updateConfig()

      this.#setuplogger(this.config.configManager)
      await this.server.restart()
    } catch (err) {
      // The restart failed. Log the error and
      // wait for another event.
      // The old app is still available
      this.#logger.error({ err })
    }

    this.#started = true
    this.#starting = false
    this.emit('start')
    this.emit('restart')
  }

  async start () {
    if (this.#starting || this.#started) {
      throw new errors.ApplicationAlreadyStartedError()
    }

    this.#starting = true

    await this.#initializeConfig()
    await this.#updateConfig()

    const configManager = this.config.configManager
    const config = configManager.current

    this.#setuplogger(configManager)

    try {
      // If this is a restart, have the fastify server restart itself. If this
      // is not a restart, then create a new server.
      this.server = await buildServer({
        app: this.config.app,
        ...config,
        configManager
      })
    } catch (err) {
      this.#logAndExit(err)
    }

    if (
      (
        config.plugins !== undefined ||
        config.versions !== undefined
      ) &&
      this.#originalWatch?.enabled !== false
    ) {
      this.#startFileWatching()
    }

    if (this.appConfig.entrypoint || this.appConfig.useHttp) {
      try {
        await this.server.start()
        /* c8 ignore next 5 */
      } catch (err) {
        this.server.log.error({ err })
        process.exit(1)
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

  async handleProcessLevelEvent ({ signal, err }) {
    /* c8 ignore next 3 */
    if (!this.server) {
      return false
    }

    if (signal === 'SIGUSR2') {
      this.server.log.info('reloading configuration')
      await this.restart()
      return false
    }

    if (err) {
      this.server.log.error({
        err: {
          message: err?.message,
          stack: err?.stack
        }
      }, 'exiting')
    } else if (signal) {
      this.server.log.info({ signal }, 'received signal')
    }

    if (this.#starting) {
      await once(this, 'start')
    }

    if (this.#started) {
      await this.stop()
      this.server.log.info('server stopped')
    }
  }

  async #initializeConfig () {
    const appConfig = this.appConfig

    let _config
    try {
      _config = await loadConfig({}, ['-c', appConfig.config], {
        onMissingEnv (key) {
          return appConfig.localServiceEnvVars.get(key)
        }
      }, true, this.#logger)
    } catch (err) {
      this.#logAndExit(err)
    }

    this.config = _config
    const { configManager } = this.config

    function applyOverrides () {
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
    }

    applyOverrides()

    this.#hotReload = this.appConfig.hotReload

    configManager.on('error', (err) => {
      /* c8 ignore next */
      this.server.log.error({ err }, 'error reloading the configuration')
    })
  }

  async #updateConfig () {
    this.#originalWatch = this.config.configManager.current.watch
    this.config.configManager.current.watch = { enabled: false }

    const { configManager } = this.config
    configManager.update({
      ...configManager.current,
      telemetry: this.#telemetryConfig
    })

    if (this.#serverConfig) {
      configManager.update({
        ...configManager.current,
        server: this.#serverConfig
      })
    }

    if (
      (this.#hasManagementApi && configManager.current.metrics === undefined) ||
      configManager.current.metrics
    ) {
      configManager.update({
        ...configManager.current,
        metrics: {
          server: 'hide',
          defaultMetrics: { enabled: this.appConfig.entrypoint },
          prefix: snakeCase(this.appConfig.id) + '_',
          ...configManager.current.metrics
        }
      })
    }

    if (!this.appConfig.entrypoint) {
      configManager.update({
        ...configManager.current,
        server: {
          ...(configManager.current.server || {}),
          trustProxy: true
        }
      })
    }
  }

  #setuplogger (configManager) {
    configManager.current.server = configManager.current.server || {}
    const level = configManager.current.server.logger?.level

    configManager.current.server.logger = level
      ? this.#logger.child({ level })
      : this.#logger
  }

  #startFileWatching () {
    if (this.#fileWatcher) {
      return
    }
    const server = this.server
    const { configManager } = server.platformatic
    const fileWatcher = new FileWatcher({
      path: dirname(configManager.fullPath),
      /* c8 ignore next 2 */
      allowToWatch: this.#originalWatch?.allow,
      watchIgnore: this.#originalWatch?.ignore || []
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

/* c8 ignore next 11 - c8 upgrade marked many existing things as uncovered */
function clearCjsCache () {
  // This evicts all of the modules from the require() cache.
  // Note: This does not clean up children references to the deleted module.
  // It's likely not a big deal for most cases, but it is a leak. The child
  // references can be cleaned up, but it is expensive and involves walking
  // the entire require() cache. See the DEP0144 documentation for how to do
  // it.
  Object.keys(require.cache).forEach((key) => {
    if (!key.match(/node_modules/)) {
      delete require.cache[key]
    }
  })
}

module.exports = { PlatformaticApp }
