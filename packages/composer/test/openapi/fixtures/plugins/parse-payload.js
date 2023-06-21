'use strict'

const fp = require('fastify-plugin')

module.exports = fp(async function (app) {
  app.platformatic.addComposerOnRouteHook('/users/{id}', ['GET'], routeOptions => {
    routeOptions.schema.response[200] = {
      type: 'object',
      properties: {
        user_id: { type: 'number' },
        first_name: { type: 'string' }
      }
    }

    async function onComposerResponse (request, reply, body) {
      const { id, name } = await body.json()
      reply.send({ user_id: id, first_name: name })
    }
    routeOptions.config.onComposerResponse = onComposerResponse
  })

  app.platformatic.addComposerOnRouteHook('/text', ['GET'], routeOptions => {
    async function onComposerResponse (request, reply, body) {
      const data = await body.text()
      reply.send('onSend hook: ' + data)
    }
    routeOptions.config.onComposerResponse = onComposerResponse
  })
})
