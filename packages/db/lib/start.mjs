import { dirname } from 'path'
import { FileWatcher } from '@platformatic/utils'
import { buildServer } from '../index.js'
import close from 'close-with-grace'
import loadConfig from './load-config.mjs'
import { compileWatch } from './compile.mjs'
import { addLoggerToTheConfig } from '@platformatic/service'

// TODO make sure coverage is reported for Windows
// Currently C8 is not reporting it
/* c8 ignore start */
export async function start (_args) {
  const { configManager } = await loadConfig({
    string: ['to']
  }, _args, { watch: true })

  const config = configManager.current

  // Set the logger if not present
  addLoggerToTheConfig(config)

  if (
    config.plugin?.typescript !== undefined &&
    config.plugin?.watch !== false &&
    config.plugin?.typescript?.build !== false
  ) {
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

  configManager.on('update', (newConfig) => onConfigUpdated(newConfig, server))
  server.app.platformatic.configManager = configManager
  server.app.platformatic.config = config

  if (
    config.plugin !== undefined &&
    config.watch !== false
  ) {
    await startFileWatching(server)
  }

  await server.listen()

  if (Object.keys(server.app.platformatic.entities).length === 0) {
    server.app.log.warn(
      'No tables found in the database. Are you connected to the right database? Did you forget to run your migrations? ' +
      'This guide can help with debugging Platformatic DB: https://oss.platformatic.dev/docs/guides/debug-platformatic-db'
    )
  }

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

async function startFileWatching (server) {
  const configManager = server.app.platformatic.configManager
  const config = configManager.current

  const fileWatcher = new FileWatcher({
    path: dirname(configManager.fullPath),
    allowToWatch: config.watch?.allow || ['*.js', '**/*.js'],
    watchIgnore: config.watch?.ignore
  })
  fileWatcher.on('update', () => {
    onFilesUpdated(server)
  })
  fileWatcher.startWatching()

  server.app.log.info('start watching files')
  server.app.platformatic.fileWatcher = fileWatcher
}

async function stopFileWatching (server) {
  const fileWatcher = server.app.platformatic.fileWatcher
  if (fileWatcher !== undefined) {
    await fileWatcher.stopWatching()

    server.app.log.info('stop watching files')
    server.app.platformatic.fileWatcher = undefined
  }
}

async function onConfigUpdated (newConfig, server) {
  try {
    server.app.platformatic.config = newConfig
    server.app.log.info('config changed')
    server.app.log.trace({ newConfig }, 'new config')

    await stopFileWatching(server)

    if (
      newConfig.plugin !== undefined &&
      newConfig.watch !== false
    ) {
      await startFileWatching(server)
    }

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
