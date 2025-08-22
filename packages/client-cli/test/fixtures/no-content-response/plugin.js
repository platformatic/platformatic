'use strict'

/** @param {import('fastify').FastifyInstance} app */
export default async function (app) {
  app.delete('/resource', async (req, reply) => {
    return reply.code(204).send()
  })
}
