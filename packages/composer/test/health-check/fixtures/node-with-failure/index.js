import fastify from 'fastify'

export function create () {
  const server = fastify()

  server.get('/api', async () => {
    // Crash after responding
    setTimeout(() => {
      throw new Error('CRASH!')
    }, 500).unref()

    return { ok: true }
  })

  return server
}
