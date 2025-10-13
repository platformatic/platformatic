/// <reference path="../../global.d.ts" />
'use strict'

/** @param {import('fastify').FastifyInstance} app */
export default async function (app) {
  // Create some custom metrics
  const { client, registry } = globalThis.platformatic.prometheus

  const requestCounter = new client.Counter({
    name: 'custom_requests_total',
    help: 'Total number of custom requests',
    registers: [registry]
  })

  const responseGauge = new client.Gauge({
    name: 'custom_response_time',
    help: 'Custom response time gauge',
    registers: [registry]
  })

  app.get('/', async () => {
    requestCounter.inc()
    responseGauge.set(Math.random() * 100)
    return { hello: 'world' }
  })

  app.get('/metrics', async () => {
    return { requests: 1 }
  })
}
