'use strict'

const underPressure = require('@fastify/under-pressure')
const fp = require('fastify-plugin')

async function setupClients (app, opts) {
  const healthCheck = opts

  app.register(underPressure, {
    exposeStatusRoute: '/status',
    healthCheckInterval: healthCheck.interval !== undefined ? healthCheck.interval : 5000,
    ...healthCheck,
    healthCheck: healthCheck.fn
  })
}

module.exports = fp(setupClients)
