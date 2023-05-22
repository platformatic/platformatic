'use strict'

const Swagger = require('@fastify/swagger')
const SwaggerUI = require('@fastify/swagger-ui')
const deepmerge = require('@fastify/deepmerge')({ all: true })
const fp = require('fastify-plugin')

// For some unknown reason, c8 is not detecting any of this
// pf
// despite being covered by test/routes.test.js
/* c8 ignore next 33 */
async function setupOpenAPI (app, opts) {
  const openapiConfig = deepmerge({
    exposeRoute: true,
    info: {
      title: 'Platformatic',
      description: 'This is a service built on top of Platformatic',
      version: '1.0.0'
    }
  }, typeof opts === 'object' ? opts : {})
  app.log.trace({ openapi: openapiConfig })
  await app.register(Swagger, {
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
  })

  const { default: theme } = await import('@platformatic/swagger-ui-theme')
  app.register(SwaggerUI, {
    ...theme,
    ...opts,
    prefix: '/documentation'
  })
}

module.exports = fp(setupOpenAPI)
