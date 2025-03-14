'use strict'

const { request } = require('undici')

module.exports = async function (fastify) {
  fastify.get('/hello', async () => {
    const { body } = await request('http://b.plt.local/hello')
    return body.json()
  })
}
