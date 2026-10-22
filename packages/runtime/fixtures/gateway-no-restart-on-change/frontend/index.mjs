import fastify from 'fastify'

export function create () {
  const app = fastify()

  app.get('/hello', async () => {
    return { from: 'frontend' }
  })

  return app
}
