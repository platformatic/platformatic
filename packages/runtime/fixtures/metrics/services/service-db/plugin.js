'use strict'

/** @param {import('fastify').FastifyInstance} app */
module.exports = async function (app) {
  app.get('/async_crash', async () => {
    setImmediate(() => {
      throw new Error('boom')
    })

    return 'ok'
  })
}
