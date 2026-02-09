export default async function (app) {
  app.platformatic.addGatewayOnRouteHook('/users', ['GET'], routeOptions => {
    const entitySchema = routeOptions.schema.response[200].items
    entitySchema.title += '_all'
  })

  app.platformatic.addGatewayOnRouteHook('/users/{id}', ['GET'], routeOptions => {
    const entitySchema = routeOptions.schema.response[200]
    entitySchema.title += '_one'
  })
}
