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

  app.post('/weird/:name', {
    schema: {
      params: {
        type: 'object',
        properties: {
          name: { type: 'string' }
        },
        required: ['name']
      },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    return { hello: request.params.name }
  })

  app.graphql.extendSchema(`
    extend type Query {
      hello: String!
    }
  `)

  app.graphql.defineResolvers({
    Query: {
      hello: async (root, args, context, info) => {
        throw new Error('hello error')
      }
    }
  })
}
