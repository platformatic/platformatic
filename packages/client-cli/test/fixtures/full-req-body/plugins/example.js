/// <reference types="@platformatic/service" />
'use strict'
/** @param {import('fastify').FastifyInstance} fastify */
module.exports = async function (fastify) {
  fastify.post('/hello', async ({ body }) => ({ body }))
}
