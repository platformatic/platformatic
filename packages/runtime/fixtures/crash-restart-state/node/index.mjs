import { getWorkerId } from '@platformatic/globals'
import fastify from 'fastify'

export function create () {
  const app = fastify()

  app.get('/hello', async (request, reply) => {
    reply.header('x-plt-port', app.server.address()?.port)
    reply.header('x-plt-worker-id', getWorkerId())
    return { from: 'node' }
  })

  // Simulates a fatal bug hit by a single worker: only the targeted worker crashes, the others refuse the request
  app.get('/crash', async (request, reply) => {
    if (request.query.worker !== String(getWorkerId())) {
      return reply.code(409).send({ worker: getWorkerId() })
    }

    setImmediate(() => {
      throw new Error('kaboom')
    })

    return { ok: true }
  })

  return app
}
