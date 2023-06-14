'use strict'

const fp = require('fastify-plugin')

async function composeOpenAPI (app, opts) {
  await app.register(require('@fastify/swagger'), {
    exposeRoute: true,
    openapi: {
      info: {
        title: opts.openapi?.title || 'Platformatic Composer',
        version: opts.openapi?.version || '1.0.0'
      }
    },
    transform: ({ schema, url }) => {
      for (const service of opts.services) {
        if (service.proxy && url.startsWith(service.proxy.prefix)) {
          schema = schema ?? {}
          schema.hide = true
          break
        }
      }
      return { schema, url }
    }
  })

  const { default: theme } = await import('@platformatic/swagger-ui-theme')
  await app.register(require('@fastify/swagger-ui'), {
    ...theme
  })
}

module.exports = fp(composeOpenAPI)
