import fp from 'fastify-plugin'

export default fp(async function (app) {
  app.platformatic.addGatewayOnRouteHook('/users/{id}', ['GET'], routeOptions => {
    routeOptions.schema.response[200] = {
      type: 'object',
      properties: {
        user_id: { type: 'number' },
        first_name: { type: 'string' }
      }
    }

    async function onGatewayResponse (request, reply, body) {
      const { id, name } = await body.json()
      reply.send({ user_id: id, first_name: name })
    }
    routeOptions.config.onGatewayResponse = onGatewayResponse
  })

  app.platformatic.addGatewayOnRouteHook('/text', ['GET'], routeOptions => {
    async function onGatewayResponse (request, reply, body) {
      const data = await body.text()
      reply.send('onSend hook: ' + data)
    }
    routeOptions.config.onGatewayResponse = onGatewayResponse
  })
})
