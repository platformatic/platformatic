import fastify from 'fastify'

export function create () {
  const app = fastify({ logger: { level: 'info' } })

  // Block the event loop synchronously, so that this thread cannot acknowledge
  // any mesh message (route added or removed) while blocked.
  // A first chunk is flushed to the client before blocking, so that the caller
  // knows exactly when the block starts.
  app.get('/block', (request, reply) => {
    const ms = Number(request.query.ms ?? 1000)

    reply.hijack()
    reply.raw.writeHead(200, { 'content-type': 'text/plain', 'transfer-encoding': 'chunked' })
    reply.raw.write('blocking\n', () => {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
      reply.raw.end('unblocked\n')
    })
  })

  // Ask the target to block its own event loop, and relay its first chunk to the caller
  app.get('/block-target', async (request, reply) => {
    const ms = Number(request.query.ms ?? 1000)
    const response = await fetch(`http://target.plt.local/block?ms=${ms}`)

    reply.hijack()
    reply.raw.writeHead(200, { 'content-type': 'text/plain', 'transfer-encoding': 'chunked' })

    try {
      for await (const chunk of response.body) {
        reply.raw.write(chunk)
      }
    } catch {
      // The target has been replaced while it was blocked
    }

    reply.raw.end()
  })

  app.get('/target', async () => {
    const response = await fetch('http://target.plt.local/')
    return response.json()
  })

  return app
}
