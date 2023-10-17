/// <reference types="@platformatic/service" />
'use strict'
/** @param {import('fastify').FastifyInstance} fastify */
module.exports = async function (fastify, opts) {
  fastify.get('/query', async (req, res) => {
    return {
      isArray: Array.isArray(req.query.ids),
      ids: req.query.ids,
      stringArrayUnion: req.query.stringArrayUnion
    }
  })
}
