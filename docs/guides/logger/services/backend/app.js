import { getLogger } from '@platformatic/globals'
import fastify from 'fastify'

const logger = getLogger()
const app = fastify({
  loggerInstance: logger.child({ })
})

app.get('/time', async () => {
  return new Date().toISOString()
})

app.listen({ port: 0 })
