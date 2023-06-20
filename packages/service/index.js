'use strict'

const { isKeyEnabled } = require('@platformatic/utils')

const compiler = require('./lib/compile')
const setupCors = require('./lib/plugins/cors')
const setupOpenAPI = require('./lib/plugins/openapi.js')
const setupGraphQL = require('./lib/plugins/graphql.js')
const setupClients = require('./lib/plugins/clients')
const setupMetrics = require('./lib/plugins/metrics')
const setupTsCompiler = require('./lib/plugins/typescript')
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
    // If file watching is enabled here, that means the service was started
    // without the runtime because the runtime explicitly disables watching on
    // services that it starts. Warn the user that things will not go as planned.
    app.log.warn('service was started with file watching enabled but watching is only available via the runtime')
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
  },
  transformConfig () {
    // Set watch to true by default. This is not possible
    // to do in the schema, because it is uses an anyOf.
    if (this.current.watch === undefined) {
      this.current.watch = true
    }
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
