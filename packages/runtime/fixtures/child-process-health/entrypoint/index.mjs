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

  // Used by the health regression test: blocks the worker thread's event loop
  // for `ms` milliseconds so we can verify the runtime still collects health
  // metrics for other workers while one thread worker is unresponsive.
  app.get('/block/:ms', async request => {
    const deadline = Date.now() + Number(request.params.ms)
    while (Date.now() < deadline) {
      // Busy-wait to block the worker thread's event loop.
    }
    return { blocked: Number(request.params.ms) }
  })

  return app
}
