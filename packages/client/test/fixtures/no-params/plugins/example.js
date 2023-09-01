/// <reference types="@platformatic/service" />
'use strict'
/** @param {import('fastify').FastifyInstance} fastify */
module.exports = async function (fastify, opts) {
  fastify.post('/hello', async (req, res) => {
    return {
      headers: req.headers,
      body: req.body,
      query: req.query
    }
  })

  fastify.get('/hello', async (req, res) => {
    return {
      message: 'GET /hello works'
    }
  })
}
