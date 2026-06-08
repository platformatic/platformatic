import { getLogger } from '@platformatic/globals'
const fastify = require('fastify')

const logger = getLogger()
const app = fastify({
  loggerInstance: logger.child({}, { level: 'trace' })
})

app.get('/', async () => {
  return { production: process.env.NODE_ENV === 'production' }
})

app.get('/version', async () => {
  return { version: 123 }
})

app.post('/', async request => {
  return { body: request.body }
})

app.log.trace('This is a trace')

app.listen({ port: 0 }).then(() => {
  app.log.info('Service listening')
})
