import fastify from 'fastify'

const app = fastify({
  loggerInstance: globalThis.platformatic.logger.child({})
})

app.get('/', async () => {
  globalThis.platformatic.logger.info('Serving request')
  return 'ok'
})

app.listen({ port: 3001 })
