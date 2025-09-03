'use strict'

module.exports = async function (fastify) {
  fastify.get('/example', async () => {
    return { hello: 'world' }
  })

  fastify.get('/config', async () => {
    return fastify.platformatic.config
  })
}
