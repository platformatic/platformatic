'use strict'

const { request } = require('undici')

module.exports = async function (fastify) {
  fastify.get('/hello', async (req, reply) => {
    const { headers, body } = await request('http://b.plt.local/hello')

    const resIntercepted = headers['x-res-intercepted']
    const {
      intercepted: reqIntercepted,
      interceptedValue: reqInterceptedValue
    } = await body.json()

    return {
      reqIntercepted,
      resIntercepted,
      reqInterceptedValue
    }
  })
}
