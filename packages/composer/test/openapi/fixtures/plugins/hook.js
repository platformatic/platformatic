'use strict'

module.exports = async function (app) {
  app.addComposerOnRouteHook('/users/{id}', ['GET'], routeOptions => {
    routeOptions.onSend = async (req, reply) => {
      reply.status(304)
      return null
    }
  })
}
