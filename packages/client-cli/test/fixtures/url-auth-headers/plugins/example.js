/// <reference types="@platformatic/service" />
'use strict'
/** @param {import('fastify').FastifyInstance} fastify */
module.exports = async function (fastify) {
  fastify.get('/docs', async ({ headers }) => {
    if (headers.authorization !== '42') {
      throw new Error('Ouch!')
    }

    return {
      openapi: '3.0.3',
      info: {
        title: 'Platformatic DB',
        description: 'Exposing a SQL database as REST',
        version: '1.0.0'
      },
      paths: {
        '/hello': {
          get: {
            operationId: 'getHello',
            responses: {
              200: {
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        foo: { type: 'string' }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  })

  fastify.get('/hello', async () => {
    return { foo: 'bar' }
  })
}
