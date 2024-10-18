/// <reference types="@platformatic/service" />
'use strict'
const { randomUUID } = require('node:crypto')
/** @param {import('fastify').FastifyInstance} fastify */
module.exports = async function (fastify, opts) {
  await fastify.register(require('@fastify/multipart'), { attachFieldsToBody: true })
  fastify.post('/formdata-movies', async (req, res) => {
    const parsedBody = {}
    Object.keys(req.body).forEach((k) => {
      parsedBody[k] = req.body[k].value.replace(/"/g, '')
    })
    return {
      id: randomUUID(),
      body: parsedBody,
      contentType: req.headers['content-type']
    }
  })
}
