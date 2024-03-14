'use strict'

const { request } = require('undici')

module.exports = async function (fastify, options) {
  fastify.get('/hello', async (_, reply) => {
    const res = await request(`${options.externalService}/hello`)
    if (res.statusCode !== 200) {
      reply.code(res.statusCode)
    }
    reply.log.info('response received')
    const data = await res.body.json()
    return data
  })
}
