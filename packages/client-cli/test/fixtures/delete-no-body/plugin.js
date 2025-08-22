'use strict'

/** @param {import('fastify').FastifyInstance} app */
export default async function (app) {
  // DELETE with query parameter
  app.delete('/resource', async (req, reply) => {
    const id = req.query.id

    if (!id) {
      return reply.code(400).send({ error: 'Missing id parameter' })
    }
    return { success: true, id }
  })

  // DELETE with path parameter
  app.delete('/resource/:id', async (req, reply) => {
    const id = req.params.id

    return { success: true, id }
  })
}
