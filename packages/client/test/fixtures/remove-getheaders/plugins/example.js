/// <reference types="@platformatic/service" />
'use strict'
/** @param {import('fastify').FastifyInstance} fastify */
module.exports = async function (fastify, opts) {
  fastify.post('/remove-getheaders', async (req, res) => {
    return {
      headerValue: req.headers.toremove,
      body: req.body,
      query: req.query
    }
  })
}
