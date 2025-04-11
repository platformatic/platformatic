import fastify from 'fastify'

const app = fastify({
  loggerInstance: globalThis.platformatic.logger?.child({}, {
    level: globalThis.platformatic.logLevel ?? 'info'
  })
})

app.get('/', async () => {
  app.log.info('call route /')
  return 'ok'
})

app.listen({ port: 3001 })

