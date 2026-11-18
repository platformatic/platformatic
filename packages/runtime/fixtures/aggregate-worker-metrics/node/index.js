import { getPrometheus, getWorkerId } from '@platformatic/globals'
import fastify from 'fastify'

export function create () {
  const { client, registry } = getPrometheus()

  const requests = new client.Counter({
    name: 'custom_requests_total',
    help: 'Custom requests',
    labelNames: ['route'],
    registers: [registry]
  })

  const duration = new client.Histogram({
    name: 'custom_request_duration_seconds',
    help: 'Custom request duration',
    labelNames: ['route'],
    buckets: [0.1, 1],
    registers: [registry]
  })

  const latency = new client.Summary({
    name: 'custom_latency_seconds',
    help: 'Custom latency',
    percentiles: [0.5],
    registers: [registry]
  })

  const app = fastify()

  app.get('/hello', async () => {
    requests.inc({ route: '/hello' })
    duration.observe({ route: '/hello' }, 0.5)
    latency.observe(0.5)

    return { worker: getWorkerId() }
  })

  return app
}
