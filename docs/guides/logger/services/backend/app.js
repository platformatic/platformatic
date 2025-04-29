import fastify from 'fastify'

const app = fastify({
  loggerInstance: globalThis.platformatic.logger.child({ })
})

app.get('/time', async () => {
  return new Date().toISOString()
})

app.listen({ port: 0 })
