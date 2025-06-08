import fastify from 'fastify'

export function create () {
  if (globalThis.platformatic.workerId > 1) {
    throw new Error('CRASH starting worker ' + globalThis.platformatic.workerId)
  }

  const app = fastify()

  app.get('/', async (request, reply) => {
    return { from: 'node' }
  })

  return app
}
