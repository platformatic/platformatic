import { dirname } from 'path'
import { FileWatcher } from '@platformatic/utils'
import { buildServer } from '../index.js'
import close from 'close-with-grace'
import loadConfig from './load-config.mjs'
import { compileWatch } from './compile.mjs'
import { addLoggerToTheConfig } from './utils.js'

// TODO make sure coverage is reported for Windows
// Currently C8 is not reporting it
/* c8 ignore start */
async function start (_args) {
  const { configManager, args } = await loadConfig({
    string: ['to']
  }, _args, { watch: true })

  let watchIgnore = null
  // Apparently C8 cannot detect these three lines on Windows
  /* c8 ignore next 3 */
  if (args['watch-ignore']) {
    watchIgnore = args['watch-ignore'].split(',')
  }
  let allowToWatch = ['*.js', '**/*.js']
  /* c8 ignore next 3 */
  if (args['allow-to-watch']) {
    allowToWatch = args['allow-to-watch'].split(',')
  }

  const config = configManager.current

  // Set the logger if not present
  addLoggerToTheConfig(config)

  if (config.typescript !== undefined && config.typescript.watch !== false) {
    try {
      await compileWatch()
    } catch (error) {
      process.exit(1)
    }
  }

  // Set the location of the config
  const server = await buildServer({
    ...config,
    configManager
  })

  const fileWatcher = new FileWatcher({
    path: dirname(configManager.fullPath),
    allowToWatch,
    watchIgnore
  })
  fileWatcher.on('update', () => {
    onFilesUpdated(server)
  })
  fileWatcher.startWatching()

  configManager.on('update', (newConfig) => onConfigUpdated(newConfig, server))
  server.app.platformatic.configManager = configManager
  server.app.platformatic.config = config

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

async function onFilesUpdated (server) {
  try {
    const config = server.app.platformatic.config
    server.app.log.info('files changed')
    await server.restart(config)
  } catch (err) {
    // TODO: test this
    server.app.log.error({
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
