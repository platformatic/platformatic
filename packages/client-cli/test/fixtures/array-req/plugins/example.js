/// <reference types="@platformatic/service" />
'use strict'
/** @param {import('fastify').FastifyInstance} fastify */
export default async function (fastify) {
  fastify.put('/array-req', async ({ body }) => body)
}
