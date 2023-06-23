'use strict'
/** @param {import('fastify').FastifyInstance} fastify */
module.exports = async function (fastify, opts) {
  fastify.get('/hello', async (request, reply) => {
    return { hello: fastify.example }
  })
}
