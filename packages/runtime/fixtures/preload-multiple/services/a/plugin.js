'use strict'

module.exports = async function (fastify, options) {
  fastify.get('/hello', async (_, reply) => {
    return { value: globalThis.value }
  })
}
