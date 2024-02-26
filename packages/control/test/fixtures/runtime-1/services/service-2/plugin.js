'use strict'

/** @param {import('fastify').FastifyInstance} app */
module.exports = async function (app, options) {
  app.get('/hello', async () => {
    return { runtime: 'runtime-1', service: 'service-2' }
  })
}
