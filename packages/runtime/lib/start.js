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

async function buildRuntime (configManager, env) {
  env = env || process.env

  if (inspector.url()) {
    throw new errors.NodeInspectorFlagsNotSupportedError()
  }

  if (configManager.args) {
    parseInspectorOptions(configManager)
  }

  const dirname = configManager.dirname
  const runtimeLogsDir = getRuntimeLogsDir(dirname, process.pid)

  const runtime = new Runtime(configManager, runtimeLogsDir, env)

  /* c8 ignore next 3 */
  process.on('SIGUSR2', async () => {
    runtime.logger.info('Received SIGUSR2, restarting all services ...')

    try {
      await runtime.restart()
    } catch (err) {
      runtime.logger.error({ err: ensureLoggableError(err) }, 'Failed to restart services.')
    }
  })

  await runtime.init()
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
  const originalPort = runtimeConfig.current.server?.port || 0
  while (address === null) {
    try {
      address = await runtime.start()
    } catch (err) {
      if (err.code === 'EADDRINUSE') {
        await runtime.close()

        if (runtimeConfig.current?.server?.port > MAX_PORT) throw err
        runtimeConfig.current.server.port++
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
    logger.warn(`Port: ${originalPort} is already in use!`)
    logger.warn(`Starting service on port: ${runtimeConfig.current.server.port}`)
  }
  return { address, runtime }
}

async function startCommand (args) {
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

    return res
  } catch (err) {
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

    console.error(err)

    process.exit(1)
  }
}

module.exports = { buildRuntime, start, startCommand, setupAndStartRuntime }
