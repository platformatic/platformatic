'use strict'

/** @param {import('fastify').FastifyInstance} app */
module.exports = async function (app, options) {
  app.get('/hello', async () => {
    return { runtime: 'runtime-2', application: 'application-2' }
  })
}
