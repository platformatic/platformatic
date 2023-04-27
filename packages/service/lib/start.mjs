import { buildServer } from '../index.js'
import close from 'close-with-grace'
import { loadConfig, generateDefaultConfig } from './load-config.js'
import { addLoggerToTheConfig } from './utils.js'

// TODO make sure coverage is reported for Windows
// Currently C8 is not reporting it
/* c8 ignore start */

function defaultConfig () {
  const _defaultConfig = generateDefaultConfig()
  return {
    watch: true,
    ..._defaultConfig
  }
}

export function buildStart (_loadConfig, _buildServer, _configManagerConfig) {
  return async function start (_args) {
    const _defaultConfig = _configManagerConfig ?? defaultConfig()
    const { configManager, args } = await _loadConfig({}, _args, _defaultConfig)

    const config = configManager.current

    // Disable hot reload from the CLI
    if (args.hotReload === false && configManager.current.plugins) {
      configManager.current.plugins.hotReload = false
    }
    addLoggerToTheConfig(config)

    const _transformConfig = configManager._transformConfig.bind(configManager)
    configManager._transformConfig = function () {
      const config = configManager.current
      if (args.hotReload === false && config.plugins) {
        config.plugins.hotReload = false
      }
      addLoggerToTheConfig(config)
      return _transformConfig(config)
    }

    let app = null

    try {
      // Set the location of the config
      app = await _buildServer({ ...config, configManager })

      await app.start()
      // TODO: this log is used in the start command. Should be replaced
      app.log.info({ url: app.url })
    } catch (err) {
      // TODO route this to a logger
      console.error(err)
      process.exit(1)
    }

    // Ignore from CI because SIGUSR2 is not available
    // on Windows
    process.on('SIGUSR2', function () {
      app.log.info('reloading configuration')
      safeRestart(app)
      return false
    })

    close(async ({ signal, err }) => {
      // Windows does not support trapping signals
      if (err) {
        app.log.error({
          err: {
            message: err.message,
            stack: err.stack
          }
        }, 'exiting')
      } else if (signal) {
        app.log.info({ signal }, 'received signal')
      }

      await app.close()
    })
  }
}

const start = buildStart(loadConfig, buildServer)

async function safeRestart (app) {
  try {
    await app.restart()
  } catch (err) {
    app.log.error({
      err: {
        message: err.message,
        stack: err.stack
      }
    }, 'failed to reload server')
  }
}

export default function (args) {
  start(args).catch(exit)
}

function exit (err) {
  console.error(err)
  process.exit(1)
}
/* c8 ignore stop */
