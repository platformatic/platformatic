/// <reference types="@platformatic/service" />
'use strict'
/** @param {import('fastify').FastifyInstance} fastify */
export default async function (fastify, opts) {
  fastify.get('/', async (request, reply) => {
    return { hello: fastify.example }
  })
}
