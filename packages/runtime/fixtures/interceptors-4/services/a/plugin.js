'use strict'

const { request, getGlobalDispatcher } = require('undici')

module.exports = async function (fastify) {
  // Explicitly set a dispatcher to a variable to check that it
  // will be swapped
  const dispatcher = getGlobalDispatcher()

  fastify.get('/hello', async (req, reply) => {
    const { headers, body } = await request('http://b.plt.local/hello', {
      dispatcher
    })

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
