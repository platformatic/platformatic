import { getLogger } from '@platformatic/globals'
import fastify from 'fastify'

const logger = getLogger()
const app = fastify({
  loggerInstance: logger.child({ })
})

app.get('/', async () => {
  app.log.debug({ secret: '1234567890' }, 'call route /')
  return 'ok'
})

app.listen({ port: 3001 })
