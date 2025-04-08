const fastify = require('fastify')

const app = fastify({
  loggerInstance: globalThis.platformatic?.logger?.child({}, { level: 'trace' })
})

app.get('/', async () => {
  return {
    production: process.env.NODE_ENV === 'production',
    plt_dev: process.env.PLT_DEV === 'true',
    plt_environment: process.env.PLT_ENVIRONMENT
  }
})

app.listen({ port: 0 }).then(() => {
  app.log.info('Service listening')
})
