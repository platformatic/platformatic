'use strict'

const deepEqual = require('fast-deep-equal')
const ConfigManager = require('@platformatic/config')
const { platformaticService, buildServer } = require('@platformatic/service')

const { schema } = require('./lib/schema')
const serviceProxy = require('./lib/proxy')
const composeOpenApi = require('./lib/openapi.js')

async function platformaticComposer (app) {
  const configManager = app.platformatic.configManager
  const config = configManager.current

  const { services } = configManager.current.composer
  for (const service of services) {
    if (!service.origin) {
      service.origin = `http://${service.id}.plt.local`
    }
  }

  async function toLoad (app) {
    app.register(composeOpenApi, config.composer)
    app.register(serviceProxy, config.composer)
  }

  toLoad[Symbol.for('skip-override')] = true
  await platformaticService(app, config, [toLoad])

  if (!app.hasRoute({ url: '/', method: 'GET' })) {
    app.register(require('./lib/root-endpoint'), config)
  }

  await watchApis(app, config)
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
  }
}

async function buildComposerServer (options) {
  return buildServer(options, platformaticComposer, ConfigManager)
}

async function watchApis (app, opts) {
  const { services, refreshTimeout } = opts.composer
  const { fetchOpenApiSchema } = await import('./lib/fetch-schemas.mjs')

  const timeout = setInterval(async () => {
    let isSchemasChanged = false

    for (const { id, origin, openapi } of services) {
      if (openapi && openapi.url) {
        const currentSchema = app.openApiSchemas.find(schema => schema.id === id)?.schema || null

        let fetchedSchema = null
        try {
          fetchedSchema = await fetchOpenApiSchema({ origin, openapi })
        } catch (error) {
          app.log.error('failed to fetch schema for ' + id)
        }

        if (!deepEqual(fetchedSchema, currentSchema)) {
          isSchemasChanged = true
          clearInterval(timeout)
          break
        }
      }
    }

    if (isSchemasChanged) {
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
  }, refreshTimeout)

  app.addHook('onClose', async () => {
    clearInterval(timeout)
  })
}

module.exports = {
  schema,
  ConfigManager,
  platformaticComposer,
  buildServer: buildComposerServer
}
