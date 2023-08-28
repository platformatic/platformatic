/// <reference types="@platformatic/service" />
'use strict'
/** @param {import('fastify').FastifyInstance} fastify */
module.exports = async function (fastify, opts) {
  fastify.decorate('example', 'foobar')
  fastify.get('/app1', async (req, res) => {
    return { app: '1', test: process.env.TEST }
  })
}
