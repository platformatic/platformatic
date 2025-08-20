import fastify from 'fastify'

export function create () {
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

  return app
}
