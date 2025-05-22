import fastify from 'fastify'

const app = fastify({
  loggerInstance: globalThis.platformatic.logger.child({})
})

app.get('/', async (req) => {
  app.log.verbose({ req }, 'call route / on node')
  return 'ok'
})

app.listen({ port: 3001 })
