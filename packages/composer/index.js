'use strict'

const deepEqual = require('fast-deep-equal')
const { resolveStackable } = require('@platformatic/basic')
const { ConfigManager } = require('@platformatic/config')
const {
  platformaticService,
  registerCriticalPlugins,
  ServiceStackable,
  configManagerConfig
} = require('@platformatic/service')
const { isKeyEnabled } = require('@platformatic/utils')
const { Generator } = require('./lib/generator')
const { schema, packageJson } = require('./lib/schema')
const schemaComponents = require('./lib/schema')
const serviceProxy = require('./lib/proxy')
const graphql = require('./lib/graphql')
const composerHook = require('./lib/composer-hook')
const { openApiGenerator, openApiComposer } = require('./lib/openapi-generator')
const graphqlGenerator = require('./lib/graphql-generator')
const { isSameGraphqlSchema, fetchGraphqlSubgraphs } = require('./lib/graphql-fetch')
const notHostConstraints = require('./lib/not-host-constraints')
const { isFetchable } = require('./lib/utils')
const errors = require('./lib/errors')

const kITC = Symbol.for('plt.runtime.itc')
const EXPERIMENTAL_GRAPHQL_COMPOSER_FEATURE_MESSAGE = 'graphql composer is an experimental feature'

async function ensureServices (composerId, config) {
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

  const { fetchOpenApiSchema } = await import('./lib/openapi-fetch-schemas.mjs')

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

async function platformaticComposer (app, stackable) {
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

  await registerCriticalPlugins(app, stackable)

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

  app.register(serviceProxy, { ...config.composer, stackable, context: stackable.context })

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
    await app.register(require('./lib/root'), config)
  }

  if (!stackable.context?.isProduction) {
    await watchServices(app, { config, stackable, context: stackable.context })
  }
}

platformaticComposer[Symbol.for('skip-override')] = true

class ComposerStackable extends ServiceStackable {
  #meta
  #dependencies

  constructor (options, root, configManager) {
    super(options, root, configManager)
    this.type = 'composer'
    this.version = packageJson.version

    this.applicationFactory = this.context.applicationFactory ?? platformaticComposer

    this.fastifyOptions ??= {}
    this.fastifyOptions.constraints = { notHost: notHostConstraints }
  }

  async getBootstrapDependencies () {
    await ensureServices(this.serviceId, this.configManager.current)

    const composedServices = this.configManager.current.composer?.services
    const dependencies = []

    if (Array.isArray(composedServices)) {
      dependencies.push(
        ...(await Promise.all(
          composedServices.map(async service => {
            return this.#parseDependency(service.id, service.origin)
          })
        ))
      )
    }

    this.#dependencies = dependencies
    return this.#dependencies
  }

  registerMeta (meta) {
    this.#meta = Object.assign(this.#meta ?? {}, meta)
  }

  async getMeta () {
    const serviceMeta = super.getMeta()
    const composerMeta = this.#meta ? { composer: this.#meta } : undefined

    return {
      ...serviceMeta,
      ...composerMeta
    }
  }

  async isHealthy () {
    // Still booting, assume healthy
    if (!this.#dependencies) {
      return true
    }

    const composedServices = this.#dependencies.map(dep => dep.id)
    const workers = await globalThis[kITC].send('getWorkers')

    for (const worker of Object.values(workers)) {
      if (composedServices.includes(worker.service) && !worker.status.startsWith('start')) {
        return false
      }
    }

    return true
  }

  async #parseDependency (id, urlString) {
    let url = `http://${id}.plt.local`

    if (urlString) {
      const remoteUrl = await this.configManager.replaceEnv(urlString)

      if (remoteUrl) {
        url = remoteUrl
      }
    }

    return { id, url, local: url.endsWith('.plt.local') }
  }
}

// This will be replace by createStackable before the release of v3
async function buildStackable (opts) {
  return createStackable(opts.context.directory, opts.config, {}, opts.context)
}

async function createStackable (fileOrDirectory, sourceOrConfig, opts, context) {
  const { root, source } = await resolveStackable(fileOrDirectory, sourceOrConfig, 'composer')
  context ??= {}
  context.directory = root

  opts ??= { context }
  opts.context = context

  const configManager = new ConfigManager({ schema, source, ...configManagerConfig, dirname: root, context })
  await configManager.parseAndValidate()

  return new ComposerStackable(opts, root, configManager)
}

module.exports = {
  Generator,
  ComposerStackable,
  errors,
  platformaticComposer,
  createStackable,
  // Old exports
  configType: 'composer',
  configManagerConfig,
  buildStackable,
  schema,
  schemaComponents,
  version: packageJson.version
}
