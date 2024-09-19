const fastify = require('fastify')

const app = fastify({
  loggerInstance: globalThis.platformatic?.logger?.child({}, { level: 'trace' })
})

app.get('/', async () => {
  return { production: process.env.NODE_ENV === 'production' }
})

app.log.trace('This is a trace')

app.listen({ port: 1 }).then(() => {
  app.log.info('Service listening')
})
