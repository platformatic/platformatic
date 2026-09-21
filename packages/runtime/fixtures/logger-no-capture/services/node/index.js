import { getLogger } from '@platformatic/globals'
import fastify from 'fastify'

const logger = getLogger()
const app = fastify({
  loggerInstance: logger.child({})
})

app.get('/', async (req) => {
  app.log.debug({ req }, 'call route / on node')
  return 'ok'
})

app.listen({ port: 3001 })
