import { isKeyEnabled } from '@platformatic/foundation'
import { platformaticService } from '@platformatic/service'
import deepEqual from 'fast-deep-equal'
import { fetchOpenApiSchema } from './commands/openapi-fetch-schemas.js'
import { composerHook } from './composer-hook.js'
import { fetchGraphqlSubgraphs, isSameGraphqlSchema } from './graphql-fetch.js'
import { graphqlGenerator } from './graphql-generator.js'
import { graphql } from './graphql.js'
import { openApiComposer, openApiGenerator } from './openapi-generator.js'
import { proxy } from './proxy.js'
import { isFetchable } from './utils.js'

const kITC = Symbol.for('plt.runtime.itc')
const EXPERIMENTAL_GRAPHQL_COMPOSER_FEATURE_MESSAGE = 'graphql composer is an experimental feature'

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
async function watchServices (app, { config, stackable }) {
  const { services, refreshTimeout } = config.composer
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

  stackable.emit('watch:start')
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

export async function ensureServices (composerId, config) {
  if (config.composer?.services?.length) {
    return
  }

  composerId ??= globalThis.platformatic?.serviceId
  config.composer ??= {}
  config.composer.services ??= []

  // When no services are defined, all services are exposed in the composer
  const services = await globalThis[kITC]?.send('listServices')

  if (services) {
    config.composer.services = services
      .filter(id => id !== composerId) // Remove ourself
      .map(id => ({ id, proxy: { prefix: `/${id}` } }))
  }
}

export async function platformaticComposer (app, stackable) {
  const config = await stackable.getConfig()
  let hasGraphqlServices, hasOpenapiServices

  // When no services are specified, get the list from the runtime.
  await ensureServices(stackable.serviceId, config)

  const { services } = config.composer

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

    config.server.healthCheck.fn = stackable.isHealthy.bind(stackable)
  }

  await app.register(proxy, { ...config.composer, stackable, context: stackable.context })

  await platformaticService(app, stackable)

  if (generatedComposedOpenAPI) {
    await app.register(openApiComposer, { opts: config.composer, generated: generatedComposedOpenAPI })
  }

  if (hasGraphqlServices) {
    app.log.warn(EXPERIMENTAL_GRAPHQL_COMPOSER_FEATURE_MESSAGE)
    app.register(graphql, config.composer)
    await app.register(graphqlGenerator, config.composer)
  }

  if (!app.hasRoute({ url: '/', method: 'GET' }) && !app.hasRoute({ url: '/*', method: 'GET' })) {
    const rootHandler = await import('./root.js')
    await app.register(rootHandler.default, config)
  }

  if (!stackable.context?.isProduction) {
    await watchServices(app, { config, stackable, context: stackable.context })
  }
}

platformaticComposer[Symbol.for('skip-override')] = true
