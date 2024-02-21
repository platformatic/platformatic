'use strict'

/** @param {import('fastify').FastifyInstance} app */
module.exports = async function (app) {
  app.get('/hello', async () => {
    return { service: 'service-1' }
  })

  app.post('/mirror', async (req, reply) => {
    reply.headers(req.headers)
    return req.body
  })
}
