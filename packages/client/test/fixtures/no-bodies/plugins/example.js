/// <reference types="@platformatic/service" />
'use strict'
/** @param {import('fastify').FastifyInstance} fastify */
module.exports = async function (fastify, opts) {
  function returnRequestBody (request, reply) {
    if (request.body) {
      reply.send(request.body)
      return
    }
    let body = ''
    request.raw.on('data', (chunk) => {
      body += chunk
    })
    request.raw.on('end', () => {
      reply.header['Content-Type'] = 'application/json'
      reply.send(body)
    })
  }

  fastify.route({
    url: '/hello',
    method: [
      'GET',
      'POST',
      'PUT',
      'PATCH',
      'DELETE',
      'HEAD',
      'OPTIONS',
      'TRACE'
    ],
    handler: returnRequestBody
  })
}
