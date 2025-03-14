'use strict'

module.exports = async function (fastify, options) {
  fastify.get('/hello', async (req) => {
    const intercepted = req.headers['x-req-intercepted']
    return { intercepted }
  })
}
