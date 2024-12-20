'use strict'

const { readFile } = require('fs/promises')
const close = require('close-with-grace')
const {
  loadConfig,
  ConfigManager,
  printConfigValidationErrors,
  printAndExitLoadConfigError
} = require('@platformatic/config')
const { addLoggerToTheConfig, isDocker } = require('./utils.js')
const { randomUUID } = require('crypto')
const { fastify } = require('fastify')

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

async function createServer (serverContext) {
  const { app, configManager, context } = serverContext
  const config = configManager.current
  let fastifyOptions = {}

  if (config.server) {
    // override hostname if it's docker
    if (await isDocker()) {
      config.server.hostname = '0.0.0.0'
    }
    fastifyOptions = {
      ...config.server
    }
  }

  Object.assign(fastifyOptions, context?.fastifyOptions ?? {})

  fastifyOptions.genReqId = function (req) {
    return randomUUID()
  }
  const root = fastify(fastifyOptions)
  root.decorate('platformatic', { configManager, config })
  await root.register(app, { context })
  if (!root.hasRoute({ url: '/', method: 'GET' }) && !root.hasRoute({ url: '/*', method: 'GET' })) {
    await root.register(require('./root-endpoint'))
  }

  root.decorate('url', {
    getter () {
      return serverContext.url
    }
  })

  return root
}
async function buildConfigManager (options, app) {
  const loggerInstance = options.server?.loggerInstance
  if (loggerInstance) {
    delete options.server.loggerInstance
    options.server ||= {}
    options.server.logger = { level: loggerInstance.level }
  }

  let configManager = options.configManager
  if (!configManager) {
    // instantiate a new config manager from current options
    configManager = new ConfigManager({ ...app.configManagerConfig, source: options })
    await configManager.parseAndValidate()
  }

  if (loggerInstance) {
    configManager.current.server ||= {}
    delete configManager.current.server.logger
    configManager.current.server.loggerInstance = loggerInstance
  }
  return configManager
}

async function buildServer (options, app, context) {
  const configManager = await buildConfigManager(options, app)
  const config = configManager.current

  // The server now can be not present, so we might need to add logger
  addLoggerToTheConfig(config)

  // options is a path
  if (typeof options === 'string') {
    options = config
  }

  if (options.server) {
    if (options.server.https) {
      options.server.https.key = await adjustHttpsKeyAndCert(options.server.https.key)
      options.server.https.cert = await adjustHttpsKeyAndCert(options.server.https.cert)
    }
  }

  const serverContext = {
    app: typeof app === 'function' ? app : app.app,
    configManager,
    context
  }
  const handler = await createServer(serverContext)
  handler.start = async function () {
    serverContext.url = await handler.listen({
      host: options.server?.hostname || '127.0.0.1',
      port: options.server?.port || 0
    })
    return serverContext.url
  }
  configManager.on('error', function (err) {
    /* c8 ignore next 1 */
    handler.log.error({ err }, 'error reloading the configuration')
  })

  return handler
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

  close(async ({ signal, err }) => {
    // Windows does not support trapping signals
    if (err) {
      app.log.error(
        {
          err: {
            message: err.message,
            stack: err.stack
          }
        },
        'exiting'
      )
    } else if (signal) {
      app.log.info({ signal }, 'received signal')
    }

    // Weird coverage issue in c8
    /* c8 ignore next 2 */
    await app.close()
  })
}

module.exports.buildConfigManager = buildConfigManager
module.exports.buildServer = buildServer
module.exports.start = start
