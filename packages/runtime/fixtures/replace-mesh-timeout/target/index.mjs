import { getWorkerId } from '@platformatic/globals'
import fastify from 'fastify'

export function create () {
  const app = fastify({ logger: { level: 'info' } })

  app.get('/', async () => {
    return { from: 'target', worker: getWorkerId() }
  })

  return app
}
