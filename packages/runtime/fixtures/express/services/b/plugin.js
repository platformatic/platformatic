'use strict'

const { request } = require('undici')

module.exports = async function (fastify) {
  fastify.get('/hello', async (_, reply) => {
    const res = await request('http://a.plt.local/hello')
    reply.log.info('response received')
    const data = await res.body.json()
    return data
  })

  fastify.get('/hello2', async (_, reply) => {
    const res = await request('http://a.plt.local/hello2')
    reply.log.info('response received')
    const data = await res.body.json()
    return data
  })

  fastify.get('/hello3', async (_, reply) => {
    const res = await request('http://127.0.0.1:9854/hello')
    reply.log.info('response received')
    const data = await res.body.json()
    return data
  })
}
