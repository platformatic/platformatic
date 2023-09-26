'use strict'

const { readFile } = require('fs/promises')
const close = require('close-with-grace')
const { loadConfig, ConfigManager, printConfigValidationErrors, printAndExitLoadConfigError } = require('@platformatic/config')
const { addLoggerToTheConfig } = require('./utils.js')
const { restartable } = require('@fastify/restartable')
const { randomUUID } = require('crypto')
async function adjustHttpsKeyAndCert (arg) {
  if (typeof arg === 'string') {
    return arg
  }

  if (!Array.isArray(arg)) {
    // { path: pathToKeyOrCert }
    return readFile(arg.path)
  }

  // Array of strings or objects.
  for (let i = 0; i < arg.length; ++i) {
    arg[i] = await adjustHttpsKeyAndCert(arg[i])
  }

  return arg
}

async function buildServer (options, app) {
  let configManager = options.configManager
  if (!configManager) {
    // instantiate a new config manager from current options
    configManager = new ConfigManager({ ...app.configManagerConfig, source: options })
    await configManager.parseAndValidate()
  }

  // options is a path
  if (typeof options === 'string') {
    options = configManager.current
  }

  let url = null

  async function createRestartable (fastify) {
    const config = configManager.current
    let fastifyOptions = {}
    if (config.server) {
      fastifyOptions = {
        ...config.server
      }
    }
    fastifyOptions.genReqId = function (req) { return randomUUID() }

    const root = fastify(fastifyOptions)
    root.decorate('platformatic', { configManager, config })
    root.register(app)

    root.decorate('url', {
      getter () {
        return url
      }
    })

    if (root.restarted) {
      root.log.info('restarted')
    }

    return root
  }

  if (options.server) {
    if (options.server.https) {
      options.server.https.key = await adjustHttpsKeyAndCert(options.server.https.key)
      options.server.https.cert = await adjustHttpsKeyAndCert(options.server.https.cert)
    }
  }
  const handler = await restartable(createRestartable)
  if (options.server) {
    handler.decorate('start', async () => {
      url = await handler.listen({ host: options.server.hostname, port: options.server.port })
      return url
    })
  }
  configManager.on('error', function (err) {
    /* c8 ignore next 1 */
    handler.log.error({ err }, 'error reloading the configuration')
  })
  return handler
}

/* c8 ignore next 12 */
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

async function start (appType, _args) {
  /* c8 ignore next 55 */
  let configManager = null
  try {
    configManager = (await loadConfig({}, _args, appType)).configManager
  } catch (err) {
    if (err.validationErrors) {
      printConfigValidationErrors(err)
      process.exit(1)
    } else {
      throw err
    }
  }

  const config = configManager.current

  addLoggerToTheConfig(config)

  const _transformConfig = configManager._transformConfig.bind(configManager)
  configManager._transformConfig = function () {
    const config = configManager.current
    addLoggerToTheConfig(config)
    return _transformConfig(config)
  }

  let app = null

  try {
    // Set the location of the config
    app = await buildServer({ ...config, configManager }, appType)
    await app.start()
  } catch (err) {
    printAndExitLoadConfigError(err)
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

    // Weird coverage issue in c8
    /* c8 ignore next 2 */
    await app.close()
  })
}

module.exports.buildServer = buildServer
module.exports.start = start
