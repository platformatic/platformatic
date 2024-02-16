'use strict'

const fastify = require('fastify')
const { isatty } = require('tty')
const platformaticVersion = require('../package.json').version

async function createManagementApi (config, runtimeApiClient) {
  addManagementApiLogger(config)
  const app = fastify(config)
  app.log.warn(
    'Runtime Management API is in the experimental stage. ' +
    'The feature is not subject to semantic versioning rules. ' +
    'Non-backward compatible changes or removal may occur in any future release. ' +
    'Use of the feature is not recommended in production environments.'
  )

  app.register(async (app) => {
    app.get('/metadata', async () => {
      return {
        pid: process.pid,
        cwd: process.cwd(),
        execPath: process.execPath,
        nodeVersion: process.version,
        platformaticVersion
      }
    })

    app.get('/services', async () => {
      return runtimeApiClient.getServices()
    })

    app.post('/services/start', async () => {
      app.log.debug('start services')
      await runtimeApiClient.start()
    })

    app.post('/services/stop', async () => {
      app.log.debug('stop services')
      await runtimeApiClient.stop()
    })

    app.post('/services/restart', async () => {
      app.log.debug('restart services')
      await runtimeApiClient.restart()
    })

    app.get('/services/:id', async (request) => {
      const { id } = request.params
      app.log.debug('get service details', { id })
      return runtimeApiClient.getServiceDetails(id)
    })

    app.get('/services/:id/config', async (request) => {
      const { id } = request.params
      app.log.debug('get service config', { id })
      return runtimeApiClient.getServiceConfig(id)
    })

    app.post('/services/:id/start', async (request) => {
      const { id } = request.params
      app.log.debug('start service', { id })
      await runtimeApiClient.startService(id)
    })

    app.post('/services/:id/stop', async (request) => {
      const { id } = request.params
      app.log.debug('stop service', { id })
      await runtimeApiClient.stopService(id)
    })

    app.all('/services/:id/proxy/*', async (request, reply) => {
      const { id, '*': requestUrl } = request.params
      app.log.debug('proxy request', { id, requestUrl })

      const injectParams = {
        method: request.method,
        url: requestUrl || '/',
        headers: request.headers,
        query: request.query,
        body: request.body
      }

      const res = await runtimeApiClient.inject(id, injectParams)

      reply
        .code(res.statusCode)
        .headers(res.headers)
        .send(res.body)
    })
  }, { prefix: '/api' })

  return app
}

function addManagementApiLogger (config) {
  let logger = config.logger
  if (!logger) {
    config.logger = {
      level: 'info',
      name: 'management-api'
    }
    logger = config.logger
  }

  /* c8 ignore next 5 */
  if (isatty(1) && !logger.transport) {
    logger.transport = {
      target: 'pino-pretty'
    }
  }
}

module.exports = { createManagementApi }
