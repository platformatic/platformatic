import fastify from 'fastify'

export function create() {
  const app = fastify({
    logger: {
      name: `${globalThis.platformatic.id}:${globalThis.platformatic.worker}`,
      level: globalThis.platformatic?.logLevel ?? 'info'
    }
  })

  app.get('/hello', async (request, reply) => {
    reply.header('x-plt-socket', request.socket.constructor.name)
    reply.header('x-plt-worker-id', globalThis.platformatic.worker)
    return { from: 'node' }
  })

  return app
}
