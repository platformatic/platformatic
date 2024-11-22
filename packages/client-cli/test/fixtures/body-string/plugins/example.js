/// <reference types="@platformatic/service" />
'use strict'
/** @param {import('fastify').FastifyInstance} fastify */
module.exports = async function (fastify) {
  fastify.post('/body-string', async ({ body }) => ({ body }))
}
