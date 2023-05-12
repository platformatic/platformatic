'use strict'

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
const { loadConfig } = require('./lib/load-config')
const { addLoggerToTheConfig } = require('./lib/utils')
const { start, buildServer } = require('./lib/start')

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

platformaticService[Symbol.for('skip-override')] = true
platformaticService.schema = schema
platformaticService.configType = 'service'
platformaticService.configManagerConfig = {
  schema,
  envWhitelist: ['PORT', 'HOSTNAME'],
  allowToWatch: ['.env'],
  schemaOptions: {
    useDefaults: true,
    coerceTypes: true,
    allErrors: true,
    strict: false
  }
}

function _buildServer (options, app) {
  return buildServer(options, app || platformaticService)
}

module.exports.buildServer = _buildServer
module.exports.schema = require('./lib/schema')
module.exports.platformaticService = platformaticService
module.exports.loadConfig = loadConfig
module.exports.addLoggerToTheConfig = addLoggerToTheConfig
module.exports.tsCompiler = compiler
module.exports.start = start
