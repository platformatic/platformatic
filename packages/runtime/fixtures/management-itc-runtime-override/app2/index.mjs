import fastify from 'fastify'

export function create () {
  const app = fastify()

  app.get('/has-management', async () => {
    return { has: !!globalThis.platformatic.management }
  })

  return app
}
