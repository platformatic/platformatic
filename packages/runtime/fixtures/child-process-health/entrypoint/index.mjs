import fastify from 'fastify'

export function create () {
  const app = fastify({
    logger: {
      name: globalThis.platformatic.applicationId,
      level: globalThis.platformatic?.logLevel ?? 'info'
    }
  })

  app.get('/hello', async () => {
    return { from: 'entrypoint' }
  })

  return app
}
