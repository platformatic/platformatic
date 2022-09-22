'use strict'

const Swagger = require('@fastify/swagger')

module.exports = async (app, opts) => {
  await app.register(Swagger, {
    routePrefix: 'documentation',
    exposeRoute: true,
    openapi: {
      info: {
        title: 'Platformatic DB Admin Routes',
        description: 'Configure and manage your Platformatic DB instance.'
      }
    }
  })
  app.register(require('./non-auth-routes'), {
    ...opts,
    prefix: ''
  })
  app.register(require('./auth-routes'), {
    ...opts,
    prefix: ''
  })
}
