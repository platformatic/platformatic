import fp from 'fastify-plugin'

async function openApiScalarPlugin (app, opts) {
  const { default: scalarTheme } = await import('@platformatic/scalar-theme')
  const { default: scalarApiReference } = await import('@scalar/fastify-api-reference')

  const routePrefix = opts.openapi?.swaggerPrefix || '/documentation'

  /** Serve spec file in yaml and json */
  app.get(`${routePrefix}/json`, { schema: { hide: true } }, async () => app.swagger())
  app.get(`${routePrefix}/yaml`, { schema: { hide: true } }, async () => app.swagger({ yaml: true }))

  await app.register(scalarApiReference, {
    logLevel: 'warn',
    routePrefix,
    configuration: {
      customCss: scalarTheme.theme
    }
  })
}

export const openApiScalar = fp(openApiScalarPlugin)
