import { isKeyEnabled } from '@platformatic/utils'
import { setupClients } from './plugins/clients.js'
import { setupCors } from './plugins/cors.js'
import { setupGraphQL } from './plugins/graphql.js'
import { setupHealthCheck } from './plugins/health-check.js'
import { setupOpenAPI } from './plugins/openapi.js'
import { loadPlugins } from './plugins/plugins.js'

export async function platformaticService (app, stackable) {
  const config = await stackable.getConfig()

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
    await app.register(loadPlugins, stackable.context)
  }

  if (isKeyEnabled('cors', config.server)) {
    await app.register(setupCors, config.server.cors)
  }

  if (isKeyEnabled('healthCheck', config.server)) {
    await app.register(setupHealthCheck, config.server.healthCheck)
  }
}

platformaticService[Symbol.for('skip-override')] = true
