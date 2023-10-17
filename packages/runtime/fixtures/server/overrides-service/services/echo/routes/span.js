'use strict'
module.exports = async function (fastify, opts) {
  // This returns the traceId set on the span by the service
  fastify.get('/', async (request, reply) => {
    const traceId = request.span.spanContext().traceId
    return { traceId }
  })
}
