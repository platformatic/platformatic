'use strict'

const deepEqual = require('fast-deep-equal')
const ConfigManager = require('@platformatic/config')
const { platformaticService, buildServer } = require('@platformatic/service')

const { schema } = require('./lib/schema')
const serviceProxy = require('./lib/proxy')
const openapi = require('./lib/openapi.js')
const graphql = require('./lib/graphql')
const composerHook = require('./lib/composer-hook')
const openapiGenerator = require('./lib/openapi-generator')
const graphqlGenerator = require('./lib/graphql-generator')
const { isSameGraphqlSchema, fetchGraphqlSubgraphs } = require('./lib/graphql-fetch')
const { isFetchable } = require('./lib/utils')
const errors = require('./lib/errors')

const EXPERIMENTAL_GRAPHQL_COMPOSER_FEATURE_MESSAGE = 'graphql composer is an experimental feature'

async function platformaticComposer (app) {
  const configManager = app.platformatic.configManager
  const config = configManager.current
  let hasGraphqlServices, hasOpenapiServices

  const { services } = configManager.current.composer
  for (const service of services) {
    if (!service.origin) {
      service.origin = `http://${service.id}.plt.local`
    }
    if (service.openapi && !hasOpenapiServices) {
      hasOpenapiServices = true
    }
    if (service.graphql && !hasGraphqlServices) {
      hasGraphqlServices = true
    }
  }

  app.register(openapi, config.composer)
  app.register(serviceProxy, config.composer)
  app.register(composerHook)
  app.register(platformaticService, config)
  
  if (hasOpenapiServices) {
    app.register(openapi, config.composer)
  }
  if (hasGraphqlServices) {
    app.log.warn(EXPERIMENTAL_GRAPHQL_COMPOSER_FEATURE_MESSAGE)
    app.register(graphql, config.composer)
  }
  app.register(serviceProxy, config.composer)
  app.register(composerHook)

  if (hasOpenapiServices) {
    await app.register(openapiGenerator, config.composer)
  }
  if (hasGraphqlServices) {
    await app.register(graphqlGenerator, config.composer)
  }

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

// TODO review no need to be async
async function buildComposerServer (options) {
// TODO ConfigManager is not been used, it's attached to platformaticComposer, can be removed
  return buildServer(options, platformaticComposer, ConfigManager)
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
    const graphqlSupergraph = await fetchGraphqlSubgraphs(graphqlServices, app.graphqlComposerOptions)
    if (!isSameGraphqlSchema(graphqlSupergraph, app.graphqlSupergraph)) {
      changed = true
      app.graphqlSupergraph = graphqlSupergraph
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
