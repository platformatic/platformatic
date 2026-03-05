import fastify from 'fastify'

export function create () {
  const app = fastify()

  app.get('/has-management', async () => {
    return { has: !!globalThis.platformatic.management }
  })

  app.get('/status', async () => {
    const status = await globalThis.platformatic.management.getRuntimeStatus()
    return { status }
  })

  return app
}
