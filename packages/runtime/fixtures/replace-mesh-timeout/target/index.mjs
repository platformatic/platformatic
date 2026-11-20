import { getWorkerId } from '@platformatic/globals'
import fastify from 'fastify'

export function create () {
  const app = fastify({ logger: { level: 'info' } })

  app.get('/', async () => {
    return { from: 'target', worker: getWorkerId() }
  })

  // Block the event loop synchronously, right after a first chunk has been flushed to the caller
  app.get('/block', (request, reply) => {
    const ms = Number(request.query.ms ?? 1000)

    reply.hijack()
    reply.raw.writeHead(200, { 'content-type': 'text/plain', 'transfer-encoding': 'chunked' })
    reply.raw.write('blocking\n', () => {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
      reply.raw.end('unblocked\n')
    })
  })

  return app
}
