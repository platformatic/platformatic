'use strict'

module.exports = async function (app) {
  app.platformatic.addComposerOnRouteHook('/users', ['GET'], routeOptions => {
    const entitySchema = routeOptions.schema.response[200].items
    entitySchema.title += '_all'
  })

  app.platformatic.addComposerOnRouteHook('/users/{id}', ['GET'], routeOptions => {
    const entitySchema = routeOptions.schema.response[200]
    entitySchema.title += '_one'
  })
}
