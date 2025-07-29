import Swagger from '@fastify/swagger'
import { deepmerge } from '@platformatic/utils'
import fp from 'fastify-plugin'

// For some unknown reason, c8 is not detecting any of this
// pf
// despite being covered by test/routes.test.js
/* c8 ignore next 33 */
async function setupOpenAPIPlugin (app, options) {
  const { openapi } = options
  const openapiConfig = deepmerge(
    {
      exposeRoute: true,
      info: {
        title: 'Platformatic',
        description: 'This is a service built on top of Platformatic',
        version: '1.0.0'
      },
      servers: [{ url: globalThis.platformatic?.runtimeBasePath ?? '/' }]
    },
    typeof openapi === 'object' ? openapi : {}
  )
  app.log.trace({ openapi: openapiConfig })
  const swaggerOptions = {
    exposeRoute: openapiConfig.exposeRoute,
    openapi: {
      ...openapiConfig
    },
    refResolver: {
      buildLocalReference (json, baseUri, fragment, i) {
        // TODO figure out if we need def-${i}
        /* istanbul ignore next */
        return json.$id || `def-${i}`
      }
    }
  }

  if (openapi.path) {
    swaggerOptions.mode = 'static'
    swaggerOptions.specification = {
      path: openapi.path
    }
  }

  await app.register(Swagger, swaggerOptions)

  const { default: scalarTheme } = await import('@platformatic/scalar-theme')
  const { default: scalarApiReference } = await import('@scalar/fastify-api-reference')

  const routePrefix = openapi.swaggerPrefix || '/documentation'

  /** Serve spec file in yaml and json */
  app.get(
    `${routePrefix}/json`,
    {
      schema: { hide: true },
      logLevel: 'warn'
    },
    async () => app.swagger()
  )
  app.get(
    `${routePrefix}/yaml`,
    {
      schema: { hide: true },
      logLevel: 'warn'
    },
    async () => app.swagger({ yaml: true })
  )

  app.register(scalarApiReference, {
    ...options,
    ...openapi,
    routePrefix,
    publicPath: './',
    configuration: {
      customCss: scalarTheme.theme
    }
  })
}

export const setupOpenAPI = fp(setupOpenAPIPlugin)
