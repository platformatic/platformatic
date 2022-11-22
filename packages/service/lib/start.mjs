import { dirname } from 'path'
import { FileWatcher } from '@platformatic/utils'
import { buildServer } from '../index.js'
import close from 'close-with-grace'
import loadConfig from './load-config.js'
import { compileWatch } from './compile.js'
import { addLoggerToTheConfig } from './utils.js'

// TODO make sure coverage is reported for Windows
// Currently C8 is not reporting it
/* c8 ignore start */
async function start (_args) {
  const { configManager } = await loadConfig({}, _args, { watch: true })

  const config = configManager.current

  // Set the logger if not present
  addLoggerToTheConfig(config)

  if (
    config.plugin?.typescript !== undefined &&
    config.plugin?.watch !== false
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

  server.app.platformatic.configManager = configManager
  server.app.platformatic.config = config
  configManager.on('update', (newConfig) => onConfigUpdated(newConfig, server))

  if (
    config.plugin !== undefined &&
    config.watch !== false
  ) {
    await startFileWatching(server)
  }

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
    allowToWatch: config.watch?.allow,
    watchIgnore: config.watch?.ignore
  })
  fileWatcher.on('update', () => {
    onFilesUpdated(server)
  })
  fileWatcher.startWatching()

  server.app.log.debug('start watching files')
  server.app.platformatic.fileWatcher = fileWatcher
}

async function stopFileWatching (server) {
  const fileWatcher = server.app.platformatic.fileWatcher
  if (fileWatcher !== undefined) {
    await fileWatcher.stopWatching()

    server.app.log.debug('stop watching files')
    server.app.platformatic.fileWatcher = undefined
  }
}

async function onConfigUpdated (newConfig, server) {
  try {
    server.app.platformatic.config = newConfig
    server.app.log.debug('config changed')
    server.app.log.trace({ newConfig }, 'new config')

    await stopFileWatching(server)

    await server.restart(newConfig)
  } catch (err) {
    // TODO: test this
    server.app.log.error({
      err: {
        message: err.message,
        stack: err.stack
      }
    }, 'failed to reload config')
  } finally {
    if (
      newConfig.plugin !== undefined &&
      newConfig.plugin.watch !== false
    ) {
      await startFileWatching(server)
    }
  }
}

async function onFilesUpdated (server) {
  // Reload the config as well, otherwise we will have problems
  // in case the files watcher triggers the config watcher too
  const configManager = server.app.platformatic.configManager
  try {
    server.app.log.debug('files changed')
    await configManager.parse()
    await server.restart(configManager.current)
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
