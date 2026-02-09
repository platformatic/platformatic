import fastify from 'fastify'

const app = fastify({
  loggerInstance: globalThis.platformatic.logger.child({})
})

app.get('/get-level', async () => {
  return { level: globalThis.platformatic.logLevel }
})

await app.listen({ port: 0 })
