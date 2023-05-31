'use strict'

/** @param {import('fastify').FastifyInstance} app */
module.exports = async function (app, options) {
  app.get('/plugin1', async () => {
    return { hello: options.name }
  })
}
