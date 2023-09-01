/// <reference types="@platformatic/service" />
'use strict'
/** @param {import('fastify').FastifyInstance} fastify */
module.exports = async function (fastify, opts) {
  fastify.get('/query', async (req, res) => {
    console.log(req.query.ids)
    return {
      isArray: Array.isArray(req.query.ids),
      ids: req.query.ids
    }
  })
}
