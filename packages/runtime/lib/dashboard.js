'use strict'

const fastify = require('fastify')
const { isatty } = require('tty')

async function createDashboard (config, runtimeApiClient) {
  addDashboardLogger(config)
  const app = fastify(config)

  app.register(async (app) => {
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
  }, { prefix: '/api' })

  return app
}

function addDashboardLogger (config) {
  let logger = config.logger
  if (!logger) {
    config.logger = {
      level: 'info',
      name: 'dashboard'
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

module.exports = { createDashboard }
