'use strict'

module.exports = async function (fastify) {
  fastify.get('/id', async () => {
    return { from: 'b' }
  })
}
