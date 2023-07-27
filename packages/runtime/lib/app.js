'use strict'

const { once } = require('node:events')
const { dirname, basename } = require('node:path')
const { FileWatcher } = require('@platformatic/utils')
const debounce = require('debounce')
const {
  buildServer,
  loadConfig
} = require('./unified-api')

class PlatformaticApp {
  #hotReload
  #loaderPort
  #restarting
  #started
  #originalWatch
  #fileWatcher
  #logger

  constructor (appConfig, loaderPort, logger) {
    this.appConfig = appConfig
    this.config = null
    this.#hotReload = false
    this.#loaderPort = loaderPort
    this.#restarting = false
    this.server = null
    this.#started = false
    this.#originalWatch = null
    this.#fileWatcher = null
    this.#logger = logger.child({
      name: this.appConfig.id
    })
  }

  getStatus () {
    if (this.#started) {
      return 'started'
    } else {
      return 'stopped'
    }
  }

  async restart (force) {
    if (this.#restarting) {
      return
    }

    if (!this.#hotReload && !force) {
      return
    }

    if (!this.#started) {
      throw new Error('application was not started')
    }

    this.#restarting = true

    /* c8 ignore next 4 - tests may not pass in a MessagePort. */
    if (this.#loaderPort) {
      this.#loaderPort.postMessage('plt:clear-cache')
      await once(this.#loaderPort, 'message')
    }

    this.#setuplogger(this.config.configManager)
    try {
      await this.server.restart()
    } catch (err) {
      this.#logAndExit(err)
    }

    this.#restarting = false
  }

  async start () {
    if (this.#started) {
      throw new Error('application is already started')
    }

    this.#started = true

    await this.#initializeConfig()
    this.#originalWatch = this.config.configManager.current.watch
    this.config.configManager.current.watch = false

    const { configManager } = this.config
    const config = configManager.current

    this.#setuplogger(configManager)

    try {
      // If this is a restart, have the fastify server restart itself. If this
      // is not a restart, then create a new server.
      this.server = await buildServer({
        ...config,
        configManager
      })
    } catch (err) {
      this.#logAndExit(err)
    }

    if (config.plugins !== undefined) {
      this.#startFileWatching()
    }

    if (this.appConfig.entrypoint) {
      try {
        await this.server.start()
        /* c8 ignore next 5 */
      } catch (err) {
        this.server.log.error({ err })
        process.exit(1)
      }
    }
  }

  async stop () {
    if (!this.#started) {
      return
    }

    await this.#stopFileWatching()
    await this.server.close()

    this.#started = false
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

    if (this.#started) {
      await this.stop()
    }
  }

  async #initializeConfig () {
    const appConfig = this.appConfig

    let _config
    try {
      _config = await loadConfig({}, ['-c', appConfig.config], null, {
        watch: true,
        onMissingEnv (key) {
          return appConfig.localServiceEnvVars.get(key)
        }
      })
    } catch (err) {
      this.#logAndExit(err)
    }

    this.config = _config
    const { configManager } = this.config

    function applyOverrides () {
      if (appConfig._configOverrides instanceof Map) {
        try {
          appConfig._configOverrides.forEach((value, key) => {
            if (typeof key !== 'string') {
              throw new Error('config path must be a string.')
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
        } catch (err) {
          configManager.stopWatching()
          throw err
        }
      }
    }

    applyOverrides()

    this.#hotReload = this.appConfig.hotReload

    configManager.on('update', async (newConfig) => {
      this.server.platformatic.config = newConfig
      applyOverrides()
      this.server.log.debug('config changed')
      this.server.log.trace({ newConfig }, 'new config')
      await this.restart()
    })

    configManager.on('error', (err) => {
      /* c8 ignore next */
      this.server.log.error({ err }, 'error reloading the configuration')
    })
  }

  #setuplogger (configManager) {
    // Set the logger if not present (and the config supports it).
    if (configManager.current.server) {
      const childLogger = this.#logger.child({}, { level: configManager.current.server.logger?.level || 'info' })
      configManager.current.server.logger = childLogger
    }
  }

  #startFileWatching () {
    if (this.#fileWatcher) {
      return
    }
    const server = this.server
    const { configManager } = server.platformatic
    // TODO FileWatcher and ConfigManager both watch the configuration file
    // we should remove the watching from the ConfigManager
    const fileWatcher = new FileWatcher({
      path: dirname(configManager.fullPath),
      /* c8 ignore next 2 */
      allowToWatch: this.#originalWatch?.allow,
      watchIgnore: [...(this.#originalWatch?.ignore || []), basename(configManager.fullPath)]
    })

    /* c8 ignore next 4 */
    const restart = debounce(() => {
      this.server.log.info('files changed')
      this.restart()
    }, 100) // debounce restart for 100ms
    fileWatcher.on('update', restart)

    fileWatcher.startWatching()
    server.log.debug('start watching files')
    server.platformatic.fileWatcher = fileWatcher
    server.platformatic.configManager.startWatching()
    this.#fileWatcher = fileWatcher
  }

  async #stopFileWatching () {
    // The configManager automatically watches for the config file changes
    // therefore we need to stop it all the times.
    await this.config.configManager.stopWatching()

    const watcher = this.#fileWatcher
    if (watcher) {
      this.server.log.debug('stop watching files')
      await watcher.stopWatching()
      this.server.platformatic.fileWatcher = undefined
      this.#fileWatcher = null
    }
  }

  #logAndExit (err) {
    this.config?.configManager?.stopWatching()
    this.#logger.error({ err })
    process.exit(1)
  }
}

module.exports = { PlatformaticApp }
