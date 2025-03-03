'use strict'

/** @param {import('fastify').FastifyInstance} app */
module.exports = async function (app) {
  app.get('/json-data', async (req, reply) => {
    return {
      id: 123,
      name: 'JSON data',
      active: true
    }
  })

  app.get('/text-data', async (req, reply) => {
    return reply
      .type('text/plain')
      .send('This is plain text data')
  })
}
