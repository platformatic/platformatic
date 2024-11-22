/// <reference types="@platformatic/service" />
'use strict'
/** @param {import('fastify').FastifyInstance} fastify */
module.exports = async function (fastify, opts) {
  fastify.get('/path/with/:fieldId', async (req, res) => {
    return {
      query: req.query,
      path: req.params
    }
  })
  fastify.post('/path/with/:fieldId', async (req, res) => {
    return {
      query: req.query,
      body: req.body,
      path: req.params
    }
  })
}
