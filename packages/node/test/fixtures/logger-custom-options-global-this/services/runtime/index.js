import { getLogger } from '@platformatic/globals'
import fastify from 'fastify'

const logger = getLogger()
const app = fastify({
  loggerInstance: logger.child({ service: 'app1' },
    {
      formatters: {
        bindings: (bindings) => {
          // For testing purposes
          return { name: bindings.service.toUpperCase() }
        },
      },
      redact: {
        paths: ['secret'],
        censor: '***HIDDEN***'
      }
    })
})

app.get('/', async () => {
  app.log.debug({ secret: '1234567890' }, 'call route /')
  return 'ok'
})

app.listen({ port: 3001 })
