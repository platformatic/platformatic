import { getWorkerId } from '@platformatic/globals'
import fastify from 'fastify'

export function create () {
  if (getWorkerId() > 1) {
    throw new Error('CRASH starting worker ' + getWorkerId())
  }

  const app = fastify()

  app.get('/', async (request, reply) => {
    return { from: 'node' }
  })

  return app
}
