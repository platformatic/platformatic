import { getApplicationId, getLogLevel, getWorkerId } from '@platformatic/globals'
import fastify from 'fastify'

export function create () {
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

  return app
}
