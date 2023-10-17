/// <reference types="@platformatic/service" />
'use strict'
/** @param {import('fastify').FastifyInstance} fastify */
module.exports = async function (fastify) {
  fastify.get('/path/:id', async ({ params, query }) => ({ id: params.id, name: query.name }))
}
