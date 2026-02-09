import fastify from 'fastify'

export function create () {
  const app = fastify({ logger: true })

  app.get('/', async () => {
    return { hello: 'world' }
  })

  return app
}
