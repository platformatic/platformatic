'use strict'

const { readFile } = require('fs/promises')

const ConfigManager = require('@platformatic/config')
const { restartable } = require('@fastify/restartable')
const { isKeyEnabled } = require('@platformatic/utils')

const compiler = require('./lib/compile')
const setupCors = require('./lib/plugins/cors')
const setupOpenAPI = require('./lib/plugins/openapi.js')
const setupGraphQL = require('./lib/plugins/graphql.js')
const setupClients = require('./lib/plugins/clients')
const setupMetrics = require('./lib/plugins/metrics')
const setupTsCompiler = require('./lib/plugins/typescript')
const setupFileWatcher = require('./lib/plugins/file-watcher')
const setupHealthCheck = require('./lib/plugins/health-check')
const loadPlugins = require('./lib/plugins/plugins')

const { schema } = require('./lib/schema')
const { loadConfig, generateDefaultConfig } = require('./lib/load-config')
const { addLoggerToTheConfig } = require('./lib/utils')

async function platformaticService (app, opts, toLoad = []) {
  const configManager = app.platformatic.configManager
  const config = configManager.current

  if (isKeyEnabled('metrics', config)) {
    app.register(setupMetrics, config.metrics)
  }

  if (Array.isArray(toLoad)) {
    for (const plugin of toLoad) {
      await app.register(plugin)
    }
  }

  const serviceConfig = config.service || {}

  if (isKeyEnabled('openapi', serviceConfig)) {
    await app.register(setupOpenAPI, serviceConfig.openapi)
  }

  if (isKeyEnabled('graphql', serviceConfig)) {
    await app.register(setupGraphQL, serviceConfig.graphql)
  }

  if (isKeyEnabled('clients', config)) {
    app.register(setupClients, config.clients)
  }

  if (config.plugins) {
    if (config.plugins.typescript) {
      await app.register(setupTsCompiler)
    }
    await app.register(loadPlugins)
  }

  if (isKeyEnabled('watch', config)) {
    await app.register(setupFileWatcher, { onFilesUpdated })
  }

  if (config.server.cors) {
    app.register(setupCors, config.server.cors)
  }

  if (isKeyEnabled('healthCheck', config.server)) {
    app.register(setupHealthCheck, config.server.healthCheck)
  }

  if (!app.hasRoute({ url: '/', method: 'GET' }) && !Array.isArray(toLoad)) {
    await app.register(require('./lib/root-endpoint'))
  }
}

platformaticService[Symbol.for('skip-override')] = true
platformaticService.schema = schema
platformaticService.envWhitelist = ['PORT', 'HOSTNAME']

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

function defaultConfig (app, source) {
  const res = {
    source,
    ...generateDefaultConfig(),
    allowToWatch: ['.env', ...(app?.allowToWatch || [])],
    envWhitelist: ['PORT', ...(app?.envWhitelist || [])]
  }

  if (app.schema) {
    res.schema = app.schema
  }

  return res
}

async function buildServer (options, app) {
  app = app || platformaticService

  let configManager = options.configManager
  if (!configManager) {
    // instantiate a new config manager from current options
    configManager = new ConfigManager(defaultConfig(app, options))
    await configManager.parseAndValidate()
  }

  // options is a path
  if (typeof options === 'string') {
    options = configManager.current
  }

  let url = null

  async function createRestartable (fastify) {
    const config = configManager.current
    const root = fastify(config.server)

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

  const { port, hostname, ...serverOptions } = options.server

  if (serverOptions.https) {
    serverOptions.https.key = await adjustHttpsKeyAndCert(serverOptions.https.key)
    serverOptions.https.cert = await adjustHttpsKeyAndCert(serverOptions.https.cert)
  }

  const handler = await restartable(createRestartable)

  configManager.on('update', async (newConfig) => {
    handler.log.debug('config changed')
    handler.log.trace({ newConfig }, 'new config')

    if (newConfig.watch === false) {
      /* c8 ignore next 4 */
      if (handler.tsCompilerWatcher) {
        handler.tsCompilerWatcher.kill('SIGTERM')
        handler.log.debug('stop watching typescript files')
      }

      if (handler.fileWatcher) {
        await handler.fileWatcher.stopWatching()
        handler.log.debug('stop watching files')
      }
    }

    await safeRestart(handler)
    /* c8 ignore next 1 */
  })

  configManager.on('error', function (err) {
    /* c8 ignore next 1 */
    handler.log.error({ err }, 'error reloading the configuration')
  })

  handler.decorate('start', async () => {
    url = await handler.listen({ host: hostname, port })
    return url
  })

  return handler
}

async function onFilesUpdated (app) {
  // Reload the config as well, otherwise we will have problems
  // in case the files watcher triggers the config watcher too
  const configManager = app.platformatic.configManager
  try {
    app.log.debug('files changed')
    await configManager.parse()
    await app.restart()
    /* c8 ignore next 8 */
  } catch (err) {
    app.log.error({
      err: {
        message: err.message,
        stack: err.stack
      }
    }, 'failed to reload server')
  }
}

async function safeRestart (app) {
  try {
    await app.restart()
    /* c8 ignore next 8 */
  } catch (err) {
    app.log.error({
      err: {
        message: err.message,
        stack: err.stack
      }
    }, 'failed to reload server')
  }
}

// This is for @platformatic/db to use
/* c8 ignore next 4 */
async function buildStart (loadConfig, buildServer, configManagerConfig) {
  const { buildStart } = await import('./lib/start.mjs')
  return buildStart(loadConfig, buildServer, configManagerConfig)
}

module.exports.buildServer = buildServer
module.exports.schema = require('./lib/schema')
module.exports.platformaticService = platformaticService
module.exports.loadConfig = loadConfig
module.exports.addLoggerToTheConfig = addLoggerToTheConfig
module.exports.generateConfigManagerConfig = generateDefaultConfig
module.exports.tsCompiler = compiler
module.exports.buildStart = buildStart
