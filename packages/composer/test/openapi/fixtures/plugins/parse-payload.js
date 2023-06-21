'use strict'

const fp = require('fastify-plugin')

module.exports = fp(async function (app) {
  app.platformatic.addComposerOnRouteHook('/users/{id}', ['GET'], routeOptions => {
    routeOptions.config.proxyResponsePayload = false

    routeOptions.schema.response[200] = {
      type: 'object',
      properties: {
        user_id: { type: 'number' },
        first_name: { type: 'string' }
      }
    }

    async function onPreSerialization (request, reply, payload) {
      return {
        user_id: payload.id,
        first_name: payload.name
      }
    }

    routeOptions.preSerialization = [onPreSerialization]
  })

  app.platformatic.addComposerOnRouteHook('/text', ['GET'], routeOptions => {
    routeOptions.config.proxyResponsePayload = false

    async function onSend (request, reply, payload) {
      return 'onSend hook: ' + payload
    }

    routeOptions.onSend = [onSend]
  })
})
