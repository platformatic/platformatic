import fastify from 'fastify'

const app = fastify({
  loggerInstance: globalThis.platformatic.logger.child({ service: 'app1' },
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
