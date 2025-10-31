import fastify from 'fastify'

export function create () {
  const app = fastify()

  app.get('/hello', async () => {
    return { from: 'application-1' }
  })

  return app
}
