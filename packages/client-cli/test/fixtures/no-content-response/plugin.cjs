'use strict'

/** @param {import('fastify').FastifyInstance} app */
module.exports = async function (app) {
  app.delete('/resource', async (req, reply) => {
    return reply.code(204).send()
  })
}
