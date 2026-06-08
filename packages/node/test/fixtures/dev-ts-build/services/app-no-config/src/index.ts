import { getLogLevel, getLogger } from '@platformatic/globals'
import fastify from 'fastify'

const logger = getLogger()
const app = fastify({
  loggerInstance: logger.child({}, { level: getLogLevel(false) ?? 'info' })
})

app.get('/', async () => {
  return { production: process.env.NODE_ENV === 'production' }
})

app.listen({ port: 0 })
