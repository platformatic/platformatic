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
        if (!service.proxy) continue

        const proxyPrefix = service.proxy.prefix.at(-1) === '/'
          ? service.proxy.prefix.slice(0, -1)
          : service.proxy.prefix

        const proxyUrls = [proxyPrefix + '/', proxyPrefix + '/*']
        if (proxyUrls.includes(url)) {
          schema = schema ?? {}
          schema.hide = true
          break
        }
      }
      return { schema, url }
    }
  })

  const { default: scalarTheme } = await import('@platformatic/scalar-theme')

  /** Serve spec file in yaml and json */
  app.get('/documentation/json', { schema: { hide: true } }, async () => app.swagger())
  app.get('/documentation/yaml', { schema: { hide: true } }, async () => app.swagger({ yaml: true }))

  const routePrefix = opts.openapi?.swaggerPrefix || '/documentation'

  await app.register(require('@scalar/fastify-api-reference'), {
    logLevel: 'warn',
    routePrefix,
    configuration: {
      customCss: scalarTheme.theme
    }
  })
}

module.exports = fp(composeOpenAPI)
