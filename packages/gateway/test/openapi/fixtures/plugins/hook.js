export default async function (app) {
  app.platformatic.addGatewayOnRouteHook('/users/{id}', ['GET'], routeOptions => {
    routeOptions.onSend = async (req, reply) => {
      reply.status(304)
      return null
    }
  })
}
