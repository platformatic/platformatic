'use strict'

module.exports = async function (fastify) {
  fastify.get('/hello', async () => {
    return { hello: 'world3' }
  })
}
