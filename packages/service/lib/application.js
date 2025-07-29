import { isKeyEnabled } from '@platformatic/utils'
import { setupClients } from './plugins/clients.js'
import { setupCors } from './plugins/cors.js'
import { setupGraphQL } from './plugins/graphql.js'
import { setupHealthCheck } from './plugins/health-check.js'
import { setupOpenAPI } from './plugins/openapi.js'
import { loadPlugins } from './plugins/plugins.js'
import { setupTsCompiler } from './plugins/typescript.js'

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
    let registerTsCompiler = false

    const typescript = config.plugins.paths && config.plugins.typescript

    /* c8 ignore next 6 */
    if (typescript === true) {
      registerTsCompiler = true
    } else if (typeof typescript === 'object') {
      registerTsCompiler = typescript.enabled === true || typescript.enabled === undefined
    }

    if (registerTsCompiler) {
      await app.register(setupTsCompiler, stackable.context)
    }

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
