import fastify from 'fastify'

const app = fastify({
  // @ts-expect-error
  loggerInstance: globalThis.platformatic?.logger?.child({}, { level: globalThis.platformatic?.logLevel ?? 'info' })
})

app.get('/', async () => {
  return { production: process.env.NODE_ENV === 'production' }
})

app.listen({ port: 1 })