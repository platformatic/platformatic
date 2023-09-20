'use strict'

/** @param {import('fastify').FastifyInstance} app */
module.exports = async function (app) {
  app.get('/custom-swagger', async (req, res) => {
    const docs = await app.inject({
      url: '/documentation/json',
      method: 'GET'
    })
    return await docs.json()
  })

  app.get('/redirect', {
    schema: {
      response: {
        302: {
          type: 'object',
          properties: {}
        },
        400: {
          type: 'object',
          properties: {
            message: { type: 'string' }
          }
        }
      }
    }
  },
  async (request, reply) => {
    return reply.code(302).redirect('https://google.com')
  })

  app.get('/returnUrl', async (req, reply) => {
    return { url: `http://${req.headers.host}` }
  })
}
