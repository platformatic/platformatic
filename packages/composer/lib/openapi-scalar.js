'use strict'

const fp = require('fastify-plugin')

async function openApiScalar (app, opts) {
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

module.exports = fp(openApiScalar)
