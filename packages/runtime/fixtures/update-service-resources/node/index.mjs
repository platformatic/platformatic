import fastify from 'fastify'

export function create () {
  const app = fastify({
    loggerInstance: globalThis.platformatic.logger.child({})
  })

  app.get('/', async (request, reply) => {
    return { from: 'node' }
  })

  return app
}
