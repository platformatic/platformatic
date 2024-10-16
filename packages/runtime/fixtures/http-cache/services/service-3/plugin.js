'use strict'

module.exports = async function (fastify) {
  let counter = 0

  fastify.get('/cached-req-counter', async (req, reply) => {
    const { maxAge } = req.query
    reply.header('Cache-Control', `public, s-maxage=${maxAge}`)
    return { service: 'service-3', counter: ++counter }
  })
}
