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
 * poll applications to detect changes, every `opts.composer.refreshTimeout`
 * polling is disabled on refreshTimeout = 0
 * or there are no network openapi nor graphql remote applications (the applications are from file or they don't have a schema/graph to fetch)
 */
async function watchApplications (app, { config, capability }) {
  const { applications, refreshTimeout } = config.composer
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

export async function ensureApplications (composerId, config) {
  if (config.composer?.applications?.length) {
    return
  }

  composerId ??= globalThis.platformatic?.applicationId
  config.composer ??= {}
  config.composer.applications ??= []

  // When no applications are defined, all applications are exposed in the composer
  const applications = await globalThis[kITC]?.send('listApplications')

  if (applications) {
    config.composer.applications = applications
      .filter(id => id !== composerId) // Remove ourself
      .map(id => ({ id, proxy: { prefix: `/${id}` } }))
  }
}

export async function platformaticComposer (app, capability) {
  const config = await capability.getConfig()
  let hasGraphqlApplications, hasOpenapiApplications

  // When no applications are specified, get the list from the runtime.
  await ensureApplications(capability.applicationId, config)

  const { applications } = config.composer

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

  await app.register(composerHook)

  let generatedComposedOpenAPI = null
  if (hasOpenapiApplications) {
    generatedComposedOpenAPI = await openApiGenerator(app, config.composer)
  }

  if (isKeyEnabled('healthCheck', config.server)) {
    if (typeof config.server.healthCheck !== 'object') {
      config.server.healthCheck = {}
    }

    config.server.healthCheck.fn = capability.isHealthy.bind(capability)
  }

  await app.register(proxy, { ...config.composer, capability, context: capability.context })

  await platformaticService(app, capability)

  if (generatedComposedOpenAPI) {
    await app.register(openApiComposer, { opts: config.composer, generated: generatedComposedOpenAPI })
  }

  if (hasGraphqlApplications) {
    app.log.warn(EXPERIMENTAL_GRAPHQL_COMPOSER_FEATURE_MESSAGE)
    app.register(graphql, config.composer)
    await app.register(graphqlGenerator, config.composer)
  }

  if (!app.hasRoute({ url: '/', method: 'GET' }) && !app.hasRoute({ url: '/*', method: 'GET' })) {
    const rootHandler = await import('./root.js')
    await app.register(rootHandler.default, config)
  }

  if (!capability.context?.isProduction) {
    await watchApplications(app, { config, capability, context: capability.context })
  }
}

platformaticComposer[Symbol.for('skip-override')] = true
