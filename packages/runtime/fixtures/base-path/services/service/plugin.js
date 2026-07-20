'use strict'

/** @param {import('fastify').FastifyInstance} app */
module.exports = async function (app) {
  app.get('/hello', async () => {
    return { capability: 'service' }
  })

  app.get('/redirect', async (req, reply) => {
    reply.redirect('/hello')
  })

  app.get('/redirect-external', async (req, reply) => {
    reply.redirect('https://example.com/oauth/authorize?client_id=123')
  })
}
