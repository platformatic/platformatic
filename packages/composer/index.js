'use strict'

const deepEqual = require('fast-deep-equal')
const ConfigManager = require('@platformatic/config')
const { platformaticService, buildServer, buildStackable } = require('@platformatic/service')
const { isKeyEnabled } = require('@platformatic/utils')

const { schema } = require('./lib/schema')
const serviceProxy = require('./lib/proxy')
const graphql = require('./lib/graphql')
const composerHook = require('./lib/composer-hook')
const { openApiGenerator, openApiComposer } = require('./lib/openapi-generator')
const graphqlGenerator = require('./lib/graphql-generator')
const { isSameGraphqlSchema, fetchGraphqlSubgraphs } = require('./lib/graphql-fetch')
const notHostConstraints = require('./lib/proxy/not-host-constraints')
const { isFetchable } = require('./lib/utils')
const { ComposerStackable, ensureServices } = require('./lib/stackable')
const errors = require('./lib/errors')
const upgrade = require('./lib/upgrade')

const EXPERIMENTAL_GRAPHQL_COMPOSER_FEATURE_MESSAGE = 'graphql composer is an experimental feature'

async function platformaticComposer (app, opts) {
  const configManager = app.platformatic.configManager
  const config = configManager.current
  let hasGraphqlServices, hasOpenapiServices

  // When no services are specified, get the list from the runtime.
  await ensureServices(opts.context?.stackable?.serviceId, config)

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

  await app.register(composerHook)

  let generatedComposedOpenAPI = null
  if (hasOpenapiServices) {
    generatedComposedOpenAPI = await openApiGenerator(app, config.composer)
  }

  if (isKeyEnabled('healthCheck', config.server)) {
    if (typeof config.server.healthCheck !== 'object') {
      config.server.healthCheck = {}
    }

    const stackable = opts.context.stackable
    config.server.healthCheck.fn = stackable.isHealthy.bind(stackable)
  }

  app.register(serviceProxy, { ...config.composer, context: opts.context })
  await app.register(platformaticService, { config: { ...config, openapi: false }, context: opts.context })

  if (generatedComposedOpenAPI) {
    await app.register(openApiComposer, { opts: config.composer, generated: generatedComposedOpenAPI })
  }

  if (hasGraphqlServices) {
    app.log.warn(EXPERIMENTAL_GRAPHQL_COMPOSER_FEATURE_MESSAGE)
    app.register(graphql, config.composer)
    await app.register(graphqlGenerator, config.composer)
  }

  if (!app.hasRoute({ url: '/', method: 'GET' }) && !app.hasRoute({ url: '/*', method: 'GET' })) {
    await app.register(require('./lib/root-endpoint'), config)
  }

  if (!opts.context?.isProduction) {
    await watchServices(app, config)
  }
}

platformaticComposer[Symbol.for('skip-override')] = true
platformaticComposer.schema = schema
platformaticComposer.configType = 'composer'
platformaticComposer.isPLTService = true
platformaticComposer.configManagerConfig = {
  version: require('./package.json').version,
  schema,
  allowToWatch: ['.env'],
  schemaOptions: {
    useDefaults: true,
    coerceTypes: true,
    allErrors: true,
    strict: false
  },
  transformConfig: platformaticService.configManagerConfig.transformConfig,
  upgrade
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
    const graphqlSupergraph = await fetchGraphqlSubgraphs(graphqlServices, app.graphqlComposerOptions, app)
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

  if (!globalThis[Symbol.for('plt.runtime.id')]) {
    app.log.warn('Watching services is only supported when running within a Platformatic Runtime.')
    return
  }

  const { fetchOpenApiSchema } = await import('./lib/openapi-fetch-schemas.mjs')

  app.log.info({ services: watching }, 'start watching services')

  const timer = setInterval(async () => {
    try {
      if (await detectServicesUpdate({ app, services: watching, fetchOpenApiSchema, fetchGraphqlSubgraphs })) {
        clearInterval(timer)
        app.log.info('detected services changes, restarting ...')

        globalThis[Symbol.for('plt.runtime.itc')].notify('changed')
      }
    } catch (error) {
      app.log.error(
        {
          err: {
            message: error.message,
            stack: error.stack
          }
        },
        'failed to get services info'
      )
    }
  }, refreshTimeout).unref()

  app.addHook('onClose', async () => {
    clearInterval(timer)
  })
}

async function buildComposerStackable (options) {
  options.context ??= {}
  options.context.fastifyOptions ??= {
    constraints: {
      notHost: notHostConstraints
    }
  }

  return buildStackable(options, platformaticComposer, ComposerStackable)
}

module.exports = platformaticComposer
module.exports.schema = schema
module.exports.platformaticComposer = platformaticComposer
module.exports.buildServer = buildComposerServer
module.exports.errors = errors
module.exports.Generator = require('./lib/generator/composer-generator')
module.exports.ConfigManager = ConfigManager
module.exports.buildStackable = buildComposerStackable
