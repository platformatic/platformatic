import { getLogger } from '@platformatic/globals'
import fastify from 'fastify'

const logger = getLogger()
const app = fastify({
  loggerInstance: logger.child({})
})

app.get('/', async () => {
  const logger = getLogger()
  logger.info('Serving request')
  return 'ok'
})

app.listen({ port: 3001 })
