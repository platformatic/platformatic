'use strict'

/** @param {import('fastify').FastifyInstance} app */
module.exports = async function (app) {
  app.get('/hello', async () => {
    return { runtime: 'runtime-1', application: 'application-1' }
  })

  app.post('/mirror', async (req, reply) => {
    reply.headers(req.headers)
    return req.body
  })
}
