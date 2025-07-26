import fp from 'fastify-plugin'

export default fp(async function (app) {
  app.decorate('foo', 'bar')
})
