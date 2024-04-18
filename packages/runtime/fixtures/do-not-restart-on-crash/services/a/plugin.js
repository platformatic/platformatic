'use strict'

module.exports = async function (fastify, options) {
  fastify.post('/crash', async (_, reply) => {
    setImmediate(() => {
      throw new Error('Crash!')
    })
  })
}
