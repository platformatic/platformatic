'use strict'

module.exports = async function (fastify) {
  fastify.addContentTypeParser('application/octet-stream', { parseAs: 'buffer' }, async (_, payload) => payload)

  fastify.get('/id', async () => {
    return { from: 'a' }
  })

  fastify.post('/echo', async (request, reply) => {
    reply.header('x-plt-custom', request.headers['x-plt-custom'])
    reply.header('connection', 'close')
    return request.body
  })
}
