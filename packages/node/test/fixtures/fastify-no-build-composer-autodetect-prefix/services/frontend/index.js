import fastify from 'fastify'

globalThis.platformatic?.setServicePrefix('/nested/base/dir')

const app = fastify({
  logger: globalThis.platformatic?.logger?.child({}, { level: globalThis.platformatic?.logLevel ?? 'info' })
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

// This would likely fail if our code doesn't work
app.listen({ port: 1 })
