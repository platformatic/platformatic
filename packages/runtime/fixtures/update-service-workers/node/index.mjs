import { getLogger } from '@platformatic/globals'
import fastify from 'fastify'

export function create () {
  const logger = getLogger()
  const app = fastify({
    loggerInstance: logger.child({})
  })

  app.get('/', async (request, reply) => {
    return { from: 'node' }
  })

  return app
}
