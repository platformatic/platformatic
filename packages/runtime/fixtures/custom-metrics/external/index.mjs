import { getApplicationId, getLogLevel, getPrometheus, getWorkerId } from '@platformatic/globals'
import fastify from 'fastify'

const { client, registry } = getPrometheus()

const metric1 = new client.Counter({
  name: 'custom_external_1',
  help: 'Custom External 1',
  registers: [registry]
})

setTimeout(() => {
  metric1.inc(123)
}, 200)

const app = fastify({
  logger: {
    name: [getApplicationId(), getWorkerId()]
      .filter(f => typeof f !== 'undefined')
      .join(':'),
    level: getLogLevel(false) ?? 'info'
  }
})

app.get('/hello', async (request, reply) => {
  reply.header('x-plt-port', app.server.address()?.port)
  reply.header('x-plt-socket', request.socket.constructor.name)
  reply.header('x-plt-worker-id', getWorkerId())
  return { from: 'node' }
})

app.listen({ port: 0 }).then(() => {
  const metric2 = new client.Gauge({
    name: 'custom_external_2',
    help: 'Custom External 2',
    registers: [registry]
  })

  setTimeout(() => {
    metric2.set(456)
  }, 200)
})
