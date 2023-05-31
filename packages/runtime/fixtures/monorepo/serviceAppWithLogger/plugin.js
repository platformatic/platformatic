'use strict'

/** @param {import('fastify').FastifyInstance} app */
module.exports = async function (app) {
  app.get('/', async () => {
    return { hello: 'world' }
  })
}
