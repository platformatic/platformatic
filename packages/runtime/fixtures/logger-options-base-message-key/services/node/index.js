import fastify from 'fastify'

const app = fastify({
  loggerInstance: globalThis.platformatic.logger.child({ })
})

app.get('/', async () => {
  app.log.debug({ secret: '1234567890' }, 'call route / on node')
  return 'ok'
})

app.listen({ port: 3001 })
