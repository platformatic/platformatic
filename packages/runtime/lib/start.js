'use strict'

const inspector = require('node:inspector')
const { writeFile } = require('node:fs/promises')
const { join, resolve, dirname } = require('node:path')

const { printConfigValidationErrors } = require('@platformatic/config')
const {
  errors: { ensureLoggableError }
} = require('@platformatic/utils')
const closeWithGrace = require('close-with-grace')
const pino = require('pino')
const pretty = require('pino-pretty')

const pkg = require('../package.json')
const { parseInspectorOptions, wrapConfigInRuntimeConfig } = require('./config')
const { Runtime } = require('./runtime')
const errors = require('./errors')
const { getRuntimeLogsDir, loadConfig } = require('./utils')

async function restartRuntime (runtime) {
  runtime.logger.info('Received SIGUSR2, restarting all services ...')

  try {
    await runtime.restart()
  } catch (err) {
    runtime.logger.error({ err: ensureLoggableError(err) }, 'Failed to restart services.')
  }
}

async function buildRuntime (configManager, env) {
  env = env || Object.assign({}, process.env, configManager.env)

  if (inspector.url() && !env.VSCODE_INSPECTOR_OPTIONS) {
    throw new errors.NodeInspectorFlagsNotSupportedError()
  }

  if (configManager.args) {
    parseInspectorOptions(configManager)
  }

  const dirname = configManager.dirname
  const runtimeLogsDir = getRuntimeLogsDir(dirname, process.pid)

  const runtime = new Runtime(configManager, runtimeLogsDir, env)

  /* c8 ignore next 3 */
  const restartListener = restartRuntime.bind(null, runtime)
  process.on('SIGUSR2', restartListener)
  runtime.on('closed', () => {
    process.removeListener('SIGUSR2', restartListener)
  })

  try {
    await runtime.init()
  } catch (e) {
    await runtime.close()
    throw e
  }

  return runtime
}

async function start (args) {
  const config = await loadConfig({}, args)

  if (config.configType !== 'runtime') {
    const configManager = await wrapConfigInRuntimeConfig(config)
    config.configManager = configManager
  }

  const app = await buildRuntime(config.configManager)
  await app.start()
  return app
}

async function setupAndStartRuntime (config) {
  const MAX_PORT = 65535
  let runtimeConfig

  if (config.configType === 'runtime') {
    config.configManager.args = config.args
    runtimeConfig = config.configManager
  } else {
    const wrappedConfig = await wrapConfigInRuntimeConfig(config)
    wrappedConfig.args = config.args
    runtimeConfig = wrappedConfig
  }

  let runtime = await buildRuntime(runtimeConfig)

  let address = null
  const startErr = null

  runtimeConfig.current.server ??= { port: 0 }
  let port = runtimeConfig.current.server.port
  while (address === null) {
    try {
      address = await runtime.start()
    } catch (err) {
      if (err.code === 'EADDRINUSE') {
        // Get the actual port from the error message if original port was 0
        if (!port) {
          const mo = err.message.match(/ address already in use (.+)/)
          const url = new URL(`http://${mo[1]}`)
          port = Number(url.port)
        }

        port++
        await runtime.close()

        if (port > MAX_PORT) {
          throw err
        }

        runtimeConfig.current.server.port = port
        runtime = await buildRuntime(runtimeConfig)
      } else {
        throw err
      }
    }
  }
  if (startErr?.code === 'PLT_RUNTIME_EADDR_IN_USE') {
    const logger = pino(
      pretty({
        translateTime: 'SYS:HH:MM:ss',
        ignore: 'hostname,pid'
      })
    )
    logger.warn(`Port: ${port} is already in use!`)
    logger.warn(`Changing the port to ${runtimeConfig.current.server.port}`)
  }
  return { address, runtime }
}

async function startCommand (args, throwAllErrors = false, returnRuntime = false) {
  try {
    const config = await loadConfig(
      {
        alias: {
          p: 'production'
        },
        boolean: ['p', 'production']
      },
      args
    )

    const startResult = await setupAndStartRuntime(config)

    const runtime = startResult.runtime
    const res = startResult.address

    closeWithGrace(async event => {
      if (event.err instanceof Error) {
        console.error(event.err)
      }
      await runtime.close()
    })

    return returnRuntime ? runtime : res
  } catch (err) {
    if (throwAllErrors && err.code !== 'PLT_RUNTIME_RUNTIME_ABORT') {
      throw err
    }

    if (err.code === 'PLT_CONFIG_NO_CONFIG_FILE_FOUND' && args.length === 1) {
      const config = {
        $schema: `https://schemas.platformatic.dev/@platformatic/service/${pkg.version}.json`,
        server: {
          hostname: '127.0.0.1',
          port: 3042,
          logger: {
            level: 'info'
          }
        },
        plugins: {
          paths: [args[0]]
        },
        service: {
          openapi: true
        },
        watch: true
      }
      const toWrite = join(dirname(resolve(args[0])), 'platformatic.service.json')
      console.log(`No config file found, creating ${join(dirname(args[0]), 'platformatic.service.json')}`)
      await writeFile(toWrite, JSON.stringify(config, null, 2))
      return startCommand(['--config', toWrite])
    }

    if (err.filenames) {
      console.error(`Missing config file!
  Be sure to have a config file with one of the following names:

  ${err.filenames.map(s => ' * ' + s).join('\n')}

  In alternative run "npm create platformatic@latest" to generate a basic plt service config.`)
      process.exit(1)
    } else if (err.validationErrors) {
      printConfigValidationErrors(err)
      process.exit(1)
    }

    if (err.code !== 'PLT_RUNTIME_RUNTIME_ABORT') {
      console.error(err)
    }

    process.exit(1)
  }
}

module.exports = { buildRuntime, start, startCommand, setupAndStartRuntime }
