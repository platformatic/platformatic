export default async function (app) {
  // Echo what the gateway parsed from the querystring: the `fields` splitting
  // happens in a preValidation hook that must survive `validation: "none"`.
  app.platformatic.addGatewayOnRouteHook('/internal/users/{id}', ['GET'], routeOptions => {
    routeOptions.onSend = async (req, reply) => {
      reply.status(200)
      return JSON.stringify({ fields: req.query.fields })
    }
  })
}
