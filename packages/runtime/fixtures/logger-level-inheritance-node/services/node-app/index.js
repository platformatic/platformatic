import { getLogLevel, getLogger } from '@platformatic/globals'
import fastify from 'fastify'

const logger = getLogger()
const app = fastify({
  loggerInstance: logger.child({})
})

app.get('/get-level', async () => {
  return { level: getLogLevel() }
})

await app.listen({ port: 0 })
