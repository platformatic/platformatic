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
      params: {
        type: 'object',
        properties: {
          messageReq: { type: 'string', nullable: true },
          dateTimeReq: { type: 'string', format: 'date-time' },
          otherDateReq: { type: 'string', format: 'date' },
          nullableDateReq: { type: 'string', format: 'date', nullable: true },
          normalStringReq: { type: 'string' }
        },
        required: ['id', 'title']
      },
      response: {
        302: {
          type: 'object',
          properties: {}
        },
        400: {
          type: 'object',
          properties: {
            messageRes: { type: 'string', nullable: true },
            dateTimeRes: { type: 'string', format: 'date-time' },
            otherDateRes: { type: 'string', format: 'date' },
            nullableDateRes: { type: 'string', format: 'date', nullable: true },
            normalStringRes: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    return reply.code(302).redirect('https://google.com')
  })

  app.get('/returnUrl', async (req, reply) => {
    return { url: `http://${req.headers.host}` }
  })

  app.post('/foobar', async (req, res) => {
    return { message: 'POST ok' }
  })
}
