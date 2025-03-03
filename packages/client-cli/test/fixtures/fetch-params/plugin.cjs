'use strict'

/** @param {import('fastify').FastifyInstance} app */
module.exports = async function (app) {
  app.get('/request-info', async (req, reply) => {
    return {
      method: 'GET',
      cache: 'no-store',
      mode: 'cors'
    }
  })
}
