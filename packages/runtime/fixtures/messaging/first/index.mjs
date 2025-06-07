import fastify from 'fastify'

export function create () {
  const app = fastify({ logger: true })

  app.get('/thread/:id', async req => {
    const response = await globalThis.platformatic.messaging.send('second', 'thread', { request: req.params.id })

    return { thread: response }
  })

  app.get('/crash', async () => {
    setImmediate(() => {
      throw new Error('kaboom')
    })

    return { hello: 'world' }
  })

  return app
}
