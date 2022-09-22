import { buildServer } from '../index.js'
import close from 'close-with-grace'
import loadConfig from './load-config.mjs'
import { addLoggerToTheConfig } from './utils.js'

// TODO make sure coverage is reported for Windows
// Currently C8 is not reporting it
/* c8 ignore start */
async function start (_args) {
  const { configManager } = await loadConfig({
    string: ['to']
  }, _args, { watch: true })

  // Set the logger if not present
  addLoggerToTheConfig(configManager.current)

  // Set the location of the config
  const server = await buildServer({
    ...configManager.current,
    configManager

  })
  configManager.on('update', (newConfig) => onConfigUpdated(newConfig, server))
  server.app.platformatic.configManager = configManager
  server.app.platformatic.config = configManager.current

  await server.listen()

  configManager.on('error', function (err) {
    server.app.log.error({
      err
    }, 'error reloading the configuration')
  })

  // Ignore from CI because SIGUSR2 is not available
  // on Windows
  process.on('SIGUSR2', function () {
    server.app.log.info('reloading configuration')
    server.restart()
      .then(() => {
        server.app.log.info('restarted')
      })
      .catch((err) => {
        server.app.log.error({
          err: {
            message: err.message,
            stack: err.stack
          }
        }, 'failed to restart')
      })
    return false
  })

  close(async ({ signal, err }) => {
    // Windows does not support trapping signals
    if (err) {
      server.app.log.error({
        err: {
          message: err.message,
          stack: err.stack
        }
      }, 'exiting')
    } else if (signal) {
      server.app.log.info({ signal }, 'received signal')
    }

    await server.stop()
  })
}

async function onConfigUpdated (newConfig, server) {
  try {
    server.app.platformatic.config = newConfig
    server.app.log.info('config changed')
    server.app.log.trace({ newConfig }, 'new config')
    await server.restart(newConfig)
  } catch (err) {
    // TODO: test this
    server.app.log.error({
      err: {
        message: err.message,
        stack: err.stack
      }
    }, 'failed to reload config')
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
