'use strict'
const { once } = require('node:events')
const { dirname } = require('node:path')
const {
  addLoggerToTheConfig
} = require('@platformatic/service')
const { FileWatcher } = require('@platformatic/utils')
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

  constructor (appConfig, loaderPort) {
    this.appConfig = appConfig
    this.config = null
    this.#hotReload = false
    this.#loaderPort = loaderPort
    this.#restarting = false
    this.server = null
    this.#started = false
    this.#originalWatch = null
  }

  async restart (force) {
    if (this.#restarting) {
      return
    }

    if (!this.#hotReload && !force) {
      return
    }

    this.#restarting = true
    await this.stop()

    /* c8 ignore next 4 - tests may not pass in a MessagePort. */
    if (this.#loaderPort) {
      this.#loaderPort.postMessage('plt:clear-cache')
      await once(this.#loaderPort, 'message')
    }

    await this.start()
    this.#restarting = false
  }

  async start () {
    if (this.#started) {
      throw new Error('application is already started')
    }

    await this.#initializeConfig()
    const { configManager } = this.config
    const config = configManager.current

    this.#originalWatch = config.watch
    config.watch = false

    try {
      // If this is a restart, have the fastify server restart itself. If this
      // is not a restart, then create a new server.
      if (this.#restarting) {
        await this.server.restart()
      } else {
        this.server = await buildServer({
          ...config,
          configManager
        })
      }
    } catch (err) {
      this.#logAndExit(err)
    }

    this.server.platformatic.configManager = configManager
    this.server.platformatic.config = config

    if (config.plugins !== undefined && this.#originalWatch !== false) {
      this.#startFileWatching()
    }

    this.#started = true

    if (this.appConfig.entrypoint && !this.#restarting) {
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
      throw new Error('application has not been started')
    }

    if (!this.#restarting) {
      await this.server.close()
    }

    await this.#stopFileWatching()
    this.#started = false
  }

  async handleProcessLevelEvent ({ msg, signal, err }) {
    if (msg === 'plt:start') {
      await this.start()
      return
    }

    if (!this.server) {
      return false
    }

    if (msg === 'plt:restart') {
      await this.restart(true)
      return
    }

    if (msg === 'plt:stop') {
      await this.stop()
      return
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

    this.config = await loadConfig({}, ['-c', appConfig.config], null, {
      watch: true,
      onMissingEnv (key) {
        return appConfig.localServiceEnvVars.get(key)
      }
    })
    const { args, configManager } = this.config

    if (appConfig._configOverrides instanceof Map) {
      try {
        appConfig._configOverrides.forEach((value, key) => {
          if (typeof key !== 'string') {
            throw new Error('config path must be a string.')
          }

          const parts = key.split('.')
          let next = configManager.current
          let obj

          for (let i = 0; next !== undefined && i < parts.length; ++i) {
            obj = next
            next = obj[parts[i]]
          }

          if (next !== undefined) {
            obj[parts.at(-1)] = value
          }
        })
      } catch (err) {
        configManager.stopWatching()
        throw err
      }
    }

    // Set the logger if not present (and the config supports it).
    if (configManager.current.server) {
      addLoggerToTheConfig(configManager.current)
      configManager.current.server.logger.name = this.appConfig.id
    }

    this.#hotReload = args.hotReload && this.appConfig.hotReload

    if (configManager.current.plugins) {
      if (this.#hotReload) {
        this.#hotReload = configManager.current.plugins.hotReload
      }

      configManager.current.plugins.hotReload = false
    }

    configManager.on('update', async (newConfig) => {
      /* c8 ignore next 4 */
      this.server.platformatic.config = newConfig
      this.server.log.debug('config changed')
      this.server.log.trace({ newConfig }, 'new config')
      await this.restart()
    })

    configManager.on('error', (err) => {
      /* c8 ignore next */
      this.server.log.error({ err }, 'error reloading the configuration')
    })
  }

  #startFileWatching () {
    const server = this.server
    const { configManager } = server.platformatic
    const fileWatcher = new FileWatcher({
      path: dirname(configManager.fullPath),
      /* c8 ignore next 2 */
      allowToWatch: this.#originalWatch?.allow,
      watchIgnore: this.#originalWatch?.ignore
    })

    fileWatcher.on('update', async () => {
      this.server.log.debug('files changed')
      this.restart()
    })

    fileWatcher.startWatching()
    server.log.debug('start watching files')
    server.platformatic.fileWatcher = fileWatcher
    server.platformatic.configManager.startWatching()
  }

  async #stopFileWatching () {
    const watcher = this.server.platformatic.fileWatcher

    if (watcher) {
      await watcher.stopWatching()
      this.server.log.debug('stop watching files')
      this.server.platformatic.fileWatcher = undefined
      this.server.platformatic.configManager.stopWatching()
    }
  }

  #logAndExit (err) {
    this.config?.configManager?.stopWatching()
    console.error(err)
    process.exit(1)
  }
}

module.exports = { PlatformaticApp }
