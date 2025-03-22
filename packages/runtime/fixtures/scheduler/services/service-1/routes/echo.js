'use strict'
module.exports = async function (fastify, opts) {
  // This returns the traceId set on the span by the service
  fastify.get('/echo-headers', async (request, reply) => {
    return { headers: request.headers }
  })
}
