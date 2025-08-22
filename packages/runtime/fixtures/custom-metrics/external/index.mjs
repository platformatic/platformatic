import fastify from 'fastify'

const { client, registry } = globalThis.platformatic.prometheus

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
    name: [globalThis.platformatic.applicationId, globalThis.platformatic.workerId]
      .filter(f => typeof f !== 'undefined')
      .join(':'),
    level: globalThis.platformatic?.logLevel ?? 'info'
  }
})

app.get('/hello', async (request, reply) => {
  reply.header('x-plt-port', app.server.address()?.port)
  reply.header('x-plt-socket', request.socket.constructor.name)
  reply.header('x-plt-worker-id', globalThis.platformatic.workerId)
  return { from: 'node' }
})

app.listen({ port: 1 }).then(() => {
  const metric2 = new client.Gauge({
    name: 'custom_external_2',
    help: 'Custom External 2',
    registers: [registry]
  })

  setTimeout(() => {
    metric2.set(456)
  }, 200)
})
