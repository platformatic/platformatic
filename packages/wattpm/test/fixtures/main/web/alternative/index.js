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

app.get('/version', async () => {
  return { version: 123 }
})

app.post('/', async request => {
  return { body: request.body }
})
app.log.trace('This is a trace')

app.listen({ port: 1 }).then(() => {
  app.log.info('Service listening')
})

app.get('/main-time', async (request, reply) => {
  const response = await fetch('http://main.plt.local/time')

  reply.code(response.status)
  return response.json()
})

globalThis.platformatic.events.on('close', () => app.close())
