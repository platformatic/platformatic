import fastify from 'fastify'

export function build () {
  globalThis.platformatic?.setBasePath('/nested/base/dir')

  const app = fastify({
    loggerInstance: globalThis.platformatic?.logger?.child({}, { level: globalThis.platformatic?.logLevel ?? 'info' })
  })

  app.get('/nested/base/dir/', async () => {
    return { production: process.env.NODE_ENV === 'production' }
  })

  app.get('/nested/base/dir/direct', async () => {
    return { ok: true }
  })

  app.get('/nested/base/dir/time', async () => {
    const response = await fetch('http://backend.plt.local/time')
    return response.json()
  })

  return app
}
