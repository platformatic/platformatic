'use strict'

/** @param {import('fastify').FastifyInstance} app */
module.exports = async function (app) {
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
}
