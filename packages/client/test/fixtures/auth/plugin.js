'use strict'

/** @param {import('fastify').FastifyInstance} app */
module.exports = async function (app) {
  app.get('/hello', async (request, reply) => {
    return { hello: 'world' }
  })

  app.get('/hello/:name', {
    schema: {
      params: {
        type: 'object',
        properties: {
          name: { type: 'string' }
        },
        required: ['name']
      }
    }
  }, async (request, reply) => {
    return { hello: request.params.name }
  })
}
