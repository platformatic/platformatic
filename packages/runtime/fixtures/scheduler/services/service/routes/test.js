'use strict'
module.exports = async function (fastify, opts) {
  let counter = 0
  // This returns the traceId set on the span by the service
  fastify.post('/inc', async (request, reply) => {
    counter++
    return { counter }
  })

  fastify.get('/counter', async (request, reply) => {
    return { counter }
  })
}
