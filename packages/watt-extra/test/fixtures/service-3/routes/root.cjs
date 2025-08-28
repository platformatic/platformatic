'use strict'

module.exports = async function (fastify) {
  fastify.get('/example', async (request, reply) => {
    setTimeout(() => { process.exit(1) }, 500)
    return { hello: 'world' }
  })
}
