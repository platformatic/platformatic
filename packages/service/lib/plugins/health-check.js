import underPressure from '@fastify/under-pressure'
import fp from 'fastify-plugin'

async function setupHealthCheckPlugin (app, options) {
  const healthCheck = options

  app.register(underPressure, {
    exposeStatusRoute: '/status',
    healthCheckInterval: healthCheck.interval !== undefined ? healthCheck.interval : 5000,
    ...healthCheck,
    healthCheck: healthCheck.fn
  })
}

export const setupHealthCheck = fp(setupHealthCheckPlugin)
