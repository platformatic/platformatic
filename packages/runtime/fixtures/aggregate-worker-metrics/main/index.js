import fastify from 'fastify'

export function create () {
  const app = fastify()
  app.get('/', async () => ({ ok: true }))
  return app
}
