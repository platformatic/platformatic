'use strict'

module.exports = async function (fastify, opts) {
  fastify.get('/bar', async function (request, reply) {
    return { hello: 'from bar' }
  })
}
