'use strict'

/** @param {import('fastify').FastifyInstance} app */
module.exports = async function (app) {
  app.get('/redirect-me', async (request, reply) => {
    return reply.status(302).redirect('https://google.com')
  })

  app.get('/non-standard', async (request, reply) => {
    return reply.status(470).send({
      foo: 'foobar',
      bar: 'bazbaz'
    })
  })
}
