'use strict'

const deepEqual = require('fast-deep-equal')
const ConfigManager = require('@platformatic/config')
const { platformaticService, buildServer } = require('@platformatic/service')

const { schema } = require('./lib/schema')
const serviceProxy = require('./lib/proxy')
const openapi = require('./lib/openapi')
const graphql = require('./lib/graphql')
const composerHook = require('./lib/composer-hook')
const openapiGenerator = require('./lib/openapi-generator')
const graphqlGenerator = require('./lib/graphql-generator')
const { isSameGraphqlSchema } = require('./lib/graphql-utils')
const errors = require('./lib/errors')
const { isFetchable } = require('./lib/utils')

async function platformaticComposer (app) {
  const configManager = app.platformatic.configManager
  const config = configManager.current

  const { services } = configManager.current.composer
  for (const service of services) {
    if (!service.origin) {
      service.origin = `http://${service.id}.plt.local`
    }
  }

  app.register(openapi, config.composer)
  app.register(serviceProxy, config.composer)
  app.register(composerHook)
  app.register(platformaticService, config)
  
  async function toLoad (app) {
    const hasOpenapiServices = services.some(s => !!s.openapi)
    const hasGraphqlServices = services.some(s => !!s.graphql)

    if (hasOpenapiServices) {
      app.register(openapi, config.composer)
    }
    if (hasGraphqlServices) {
      app.register(graphql, config.composer)
    }
    app.register(serviceProxy, config.composer)
    app.register(composerHook)
  }

  toLoad[Symbol.for('skip-override')] = true
  await platformaticService(app, config, [toLoad])

  await app.register(openapiGenerator, config.composer)
  await app.register(graphqlGenerator, config.composer)

  if (!app.hasRoute({ url: '/', method: 'GET' })) {
    await app.register(require('./lib/root-endpoint'), config)
  }

  await watchServices(app, config)
}

platformaticComposer[Symbol.for('skip-override')] = true
platformaticComposer.schema = schema
platformaticComposer.configType = 'composer'
platformaticComposer.configManagerConfig = {
  schema,
  envWhitelist: ['PORT', 'HOSTNAME'],
  allowToWatch: ['.env'],
  schemaOptions: {
    useDefaults: true,
    coerceTypes: true,
    allErrors: true,
    strict: false
  },
  transformConfig: platformaticService.configManagerConfig.transformConfig
}

async function buildComposerServer (options) {
  return buildServer(options, platformaticComposer)
}

async function detectServicesUpdate ({ app, services, fetchOpenApiSchema, fetchGraphqlSubgraphs }) {
  let changed

  const graphqlServices = []
  // assumes services here are fetchable
  for (const service of services) {
    const { id, origin, openapi, graphql } = service

    if (openapi) {
      const currentSchema = app.openApiSchemas.find(schema => schema.id === id)?.originSchema || null

      let fetchedSchema = null
      try {
        fetchedSchema = await fetchOpenApiSchema({ origin, openapi })
      } catch (err) {
        app.log.error({ err }, 'failed to fetch schema (watch) for service ' + id)
      }

      if (!changed && !deepEqual(fetchedSchema, currentSchema)) {
        changed = true
        // it stops at first schema difference since all the schemas will be updated on reload
        break
      }
    }

    if (graphql) {
      graphqlServices.push(service)
    }
  }

  if (!changed && graphqlServices.length > 0) {
    try {
      const graphqlSupergraph = await fetchGraphqlSubgraphs(graphqlServices)
      if (!isSameGraphqlSchema(graphqlSupergraph, app.graphqlSupergraph)) {
        changed = true
        app.graphqlSupergraph = graphqlSupergraph
      }
    } catch (err) {
      // TODO spy test
      app.log.error({ err }, 'failed to fetch graphql subgraphs (watch) from services')
    }
  }

  return changed
}

/**
 * poll services to detect changes, every `opts.composer.refreshTimeout`
 * polling is disabled on refreshTimeout = 0
 * or there are no network openapi nor graphql remote services (the services are from file or they don't have a schema/graph to fetch)
*/
async function watchServices (app, opts) {
  const { services, refreshTimeout } = opts.composer
  if (refreshTimeout < 1) {
    return
  }

  const watching = services.filter(isFetchable)
  if (watching.length < 1) {
    return
  }

  const { fetchOpenApiSchema } = await import('./lib/openapi-fetch-schemas.mjs')
  const { fetchGraphqlSubgraphs } = await import('./lib/graphql-fetch-subgraphs.mjs')

  app.log.info({ services: watching }, 'start watching services')

  const timer = setInterval(async () => {
    try {
      if (await detectServicesUpdate({ app, services: watching, fetchOpenApiSchema, fetchGraphqlSubgraphs })) {
        clearInterval(timer)
        app.log.info('reloading server')
        try {
          await app.restart()
          /* c8 ignore next 8 */
        } catch (error) {
          app.log.error({
            err: {
              message: error.message,
              stack: error.stack
            }
          }, 'failed to reload server')
        }
      }
    } catch (error) {
      app.log.error({
        err: {
          message: error.message,
          stack: error.stack
        }
      }, 'failed to get services info')
    }
  }, refreshTimeout).unref()

  app.addHook('onClose', async () => {
    clearInterval(timer)
  })
}

module.exports = {
  schema,
  ConfigManager,
  platformaticComposer,
  buildServer: buildComposerServer,
  errors,
  Generator: require('./lib/generator/composer-generator')
}
