import { getApplicationId, getLogLevel, getPrometheus, getWorkerId } from '@platformatic/globals'
import fastify from 'fastify'

// This service runs as a command (`node index.mjs`), so it is executed in a child
// process through the childManager. Metrics are collected into the child registry.
const { client, registry } = getPrometheus()

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

const app = fastify({
  logger: {
    name: [getApplicationId(), getWorkerId()].filter(f => typeof f !== 'undefined').join(':'),
    level: getLogLevel(false) ?? 'info'
  }
})

app.get('/', async () => {
  requestCounter.inc()
  responseGauge.set(Math.random() * 100)
  return { hello: 'world' }
})

app.listen({ host: '127.0.0.1', port: 0 })
