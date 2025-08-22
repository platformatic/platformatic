'use strict'

/** @param {import('fastify').FastifyInstance} app */
export default async function (app) {
  app.get('/optional-params', async (req, reply) => {
    return {
      required: req.query.required,
      optional: req.query.optional || null
    }
  })
}
