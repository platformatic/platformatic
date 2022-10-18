'use strict'

const Swagger = require('@fastify/swagger')

module.exports = async (app, opts) => {
  await app.register(Swagger, {
    routePrefix: 'documentation',
    openapi: {
      info: {
        title: 'Platformatic DB Admin Routes',
        description: 'Configure and manage your Platformatic DB instance.'
      }
    }
  })

  app.route({
    url: '/documentation/json',
    method: 'GET',
    schema: { hide: true },
    handler: function (req, reply) {
      reply.send(app.swagger())
    }
  })

  app.route({
    url: '/documentation/yaml',
    method: 'GET',
    schema: { hide: true },
    handler: function (req, reply) {
      reply
        .type('application/x-yaml')
        .send(app.swagger({ yaml: true }))
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
