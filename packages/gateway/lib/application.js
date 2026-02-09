import { isKeyEnabled } from '@platformatic/foundation'
import { platformaticService } from '@platformatic/service'
import deepEqual from 'fast-deep-equal'
import { fetchOpenApiSchema } from './commands/openapi-fetch-schemas.js'
import { gatewayHook } from './gateway-hook.js'
import { fetchGraphqlSubgraphs, isSameGraphqlSchema } from './graphql-fetch.js'
import { graphqlGenerator } from './graphql-generator.js'
import { graphql } from './graphql.js'
import { openApiGateway, openApiGenerator } from './openapi-generator.js'
import { proxy } from './proxy.js'
import { isFetchable } from './utils.js'

const kITC = Symbol.for('plt.runtime.itc')
const EXPERIMENTAL_GRAPHQL_GATEWAY_FEATURE_MESSAGE = 'graphql composer is an experimental feature'

async function detectApplicationsUpdate ({ app, applications, fetchOpenApiSchema, fetchGraphqlSubgraphs }) {
  let changed

  const graphqlApplications = []
  // assumes applications here are fetchable
  for (const application of applications) {
    const { id, origin, openapi, graphql } = application

    if (openapi) {
      const currentSchema = app.openApiSchemas.find(schema => schema.id === id)?.originSchema || null

      let fetchedSchema = null
      try {
        fetchedSchema = await fetchOpenApiSchema({ origin, openapi })
      } catch (err) {
        app.log.error({ err }, 'failed to fetch schema (watch) for application ' + id)
      }

      if (!changed && !deepEqual(fetchedSchema, currentSchema)) {
        changed = true
        // it stops at first schema difference since all the schemas will be updated on reload
        break
      }
    }

    if (graphql) {
      graphqlApplications.push(application)
    }
  }

  if (!changed && graphqlApplications.length > 0) {
    const graphqlSupergraph = await fetchGraphqlSubgraphs(graphqlApplications, app.graphqlComposerOptions, app)
    if (!isSameGraphqlSchema(graphqlSupergraph, app.graphqlSupergraph)) {
      changed = true
      app.graphqlSupergraph = graphqlSupergraph
    }
  }

  return changed
}

/**
 * poll applications to detect changes, every `opts.gateway.refreshTimeout`
 * polling is disabled on refreshTimeout = 0
 * or there are no network openapi nor graphql remote applications (the applications are from file or they don't have a schema/graph to fetch)
 */
async function watchApplications (app, { config, capability }) {
  const { applications, refreshTimeout } = config.gateway
  if (refreshTimeout < 1) {
    return
  }

  const watching = applications.filter(isFetchable)
  if (watching.length < 1) {
    return
  }

  if (!globalThis[Symbol.for('plt.runtime.id')]) {
    app.log.warn('Watching applications is only supported when running within a Platformatic Runtime.')
    return
  }

  capability.emit('watch:start')
  app.log.info({ applications: watching }, 'start watching applications')

  const timer = setInterval(async () => {
    try {
      if (await detectApplicationsUpdate({ app, applications: watching, fetchOpenApiSchema, fetchGraphqlSubgraphs })) {
        clearInterval(timer)
        app.log.info('detected applications changes, restarting ...')

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
        'failed to get applications info'
      )
    }
  }, refreshTimeout).unref()

  app.addHook('onClose', async () => {
    clearInterval(timer)
  })
}

export async function ensureApplications (gatewayId, config) {
  if (config.gateway?.applications?.length) {
    return
  }

  gatewayId ??= globalThis.platformatic?.applicationId
  config.gateway ??= {}
  config.gateway.applications ??= []

  // When no applications are defined, all applications are exposed in the gateway
  const applications = await globalThis[kITC]?.send('listApplications')

  if (applications) {
    config.gateway.applications = applications
      .filter(id => id !== gatewayId) // Remove ourself
      .map(id => ({ id, proxy: { prefix: `/${id}` } }))
  }
}

export async function platformaticGateway (app, capability) {
  const config = await capability.getConfig()
  let hasGraphqlApplications, hasOpenapiApplications

  // When no applications are specified, get the list from the runtime.
  await ensureApplications(capability.applicationId, config)

  const { applications } = config.gateway

  for (const application of applications) {
    if (!application.origin) {
      application.origin = `http://${application.id}.plt.local`
    }
    if (application.openapi && !hasOpenapiApplications) {
      hasOpenapiApplications = true
    }
    if (application.graphql && !hasGraphqlApplications) {
      hasGraphqlApplications = true
    }
  }

  await app.register(gatewayHook)

  // Register pass-through content type parsers from config
  const passthroughTypes = config.gateway.passthroughContentTypes ||
                          ['multipart/form-data', 'application/octet-stream']
  for (const contentType of passthroughTypes) {
    if (!app.hasContentTypeParser(contentType)) {
      app.addContentTypeParser(contentType, function (req, body, done) {
        done(null, body)
      })
    }
  }

  let generatedComposedOpenAPI = null
  if (hasOpenapiApplications) {
    generatedComposedOpenAPI = await openApiGenerator(app, config.gateway)
  }

  if (isKeyEnabled('healthCheck', config.server)) {
    if (typeof config.server.healthCheck !== 'object') {
      config.server.healthCheck = {}
    }

    config.server.healthCheck.fn = capability.isHealthy.bind(capability)
  }

  await app.register(proxy, { ...config.gateway, capability, context: capability.context })

  await platformaticService(app, capability)

  if (generatedComposedOpenAPI) {
    await app.register(openApiGateway, { opts: config.gateway, generated: generatedComposedOpenAPI })
  }

  if (hasGraphqlApplications) {
    app.log.warn(EXPERIMENTAL_GRAPHQL_GATEWAY_FEATURE_MESSAGE)
    app.register(graphql, config.gateway)
    await app.register(graphqlGenerator, config.gateway)
  }

  if (!app.hasRoute({ url: '/', method: 'GET' }) && !app.hasRoute({ url: '/*', method: 'GET' })) {
    const rootHandler = await import('./root.js')
    await app.register(rootHandler.default, config)
  }

  if (!capability.context?.isProduction) {
    await watchApplications(app, { config, capability, context: capability.context })
  }
}

platformaticGateway[Symbol.for('skip-override')] = true
