'use strict'

const { telemetry } = require('@platformatic/telemetry')
const { isKeyEnabled } = require('@platformatic/utils')
const setupCors = require('./plugins/cors.js')
const setupClients = require('./plugins/clients.js')
const setupGraphQL = require('./plugins/graphql.js')
const setupHealthCheck = require('./plugins/health-check.js')
const setupOpenAPI = require('./plugins/openapi.js')
const loadPlugins = require('./plugins/plugins.js')
const setupTsCompiler = require('./plugins/typescript.js')

async function platformaticService (app, stackable) {
  const config = await stackable.getConfig()

  // This must be done before loading the plugins, so they can inspect if the
  // openTelemetry decorator exists and then configure accordingly.
  if (!stackable.context.telemetryRegistered && isKeyEnabled('telemetry', config)) {
    await app.register(telemetry, config.telemetry)
    stackable.context.telemetryRegistered = true
  }

  // This must be done before loading the plugins, so they can be configured accordingly
  if (isKeyEnabled('clients', config)) {
    await app.register(setupClients, config.clients)
  }

  const serviceConfig = config.service || {}

  if (isKeyEnabled('openapi', serviceConfig)) {
    const openapi = serviceConfig.openapi
    await app.register(setupOpenAPI, { openapi })
  }

  if (isKeyEnabled('graphql', serviceConfig)) {
    await app.register(setupGraphQL, serviceConfig.graphql)
  }

  if (config.plugins) {
    let registerTsCompiler = false

    const typescript = config.plugins.paths && config.plugins.typescript

    /* c8 ignore next 6 */
    if (typescript === true) {
      registerTsCompiler = true
    } else if (typeof typescript === 'object') {
      registerTsCompiler = typescript.enabled === true || typescript.enabled === undefined
    }

    if (registerTsCompiler) {
      await app.register(setupTsCompiler, { context: stackable.context })
    }

    await app.register(loadPlugins, { context: stackable.context })
  }

  if (isKeyEnabled('cors', config.server)) {
    await app.register(setupCors, config.server.cors)
  }

  if (isKeyEnabled('healthCheck', config.server)) {
    await app.register(setupHealthCheck, config.server.healthCheck)
  }
}

platformaticService[Symbol.for('skip-override')] = true

module.exports = { platformaticService }
