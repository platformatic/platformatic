'use strict'

/** @param {import('fastify').FastifyInstance} app */
module.exports = async function (app) {
  app.addHook('onReady', async () => {
    throw new Error('boom on ready')
  })
}
