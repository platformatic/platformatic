'use strict'

module.exports = async function (fastify) {
  fastify.get('/beta', async () => {
    return { from: 'beta' }
  })
}
