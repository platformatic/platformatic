'use strict'

/** @param {import('fastify').FastifyInstance} app */
module.exports = async function (app) {
  app.get('/optional-params', async (req, reply) => {
    return {
      required: req.query.required,
      optional: req.query.optional || null
    }
  })
}
