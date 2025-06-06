import fastify from 'fastify'

export function create () {
  console.log(' ********* ', globalThis.platformatic.workerId)

  if (globalThis.platformatic.workerId > 2) {
    throw new Error('CRASH starting worker ' + globalThis.platformatic.workerId)
  }

  const app = fastify()

  app.get('/', async (request, reply) => {
    return { from: 'node' }
  })

  return app
}
