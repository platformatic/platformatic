'use strict'

module.exports = async function (app) {
  app.addComposerOnRouteHook('/users/{id}', ['GET'], routeOptions => {
    routeOptions.schema.response[200] = {
      description: 'This is a test',
      type: 'object'
    }
  })

  app.addComposerOnRouteHook('/users/{id}', ['GET'], routeOptions => {
    routeOptions.onSend = async (req, reply) => {
      reply.status(200)
      return JSON.stringify(req.routeSchema)
    }
  })
}
