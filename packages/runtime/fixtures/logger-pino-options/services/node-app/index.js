import { getLogger } from '@platformatic/globals'
import fastify from 'fastify'

const logger = getLogger()
const app = fastify({ loggerInstance: logger.child({}) })

app.get('/logs', async () => {
  logger.custom({ secret: 'hidden', hello: 'world' }, 'call route /logs')
  return 'ok'
})

await app.listen({ port: 0 })
