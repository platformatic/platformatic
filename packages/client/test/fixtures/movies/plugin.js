'use strict'

/** @param {import('fastify').FastifyInstance} app */
module.exports = async function (app) {
  app.put('/movies/:id/:title', {
    schema: {
      operationId: 'updateMovieTitle',
      params: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
        },
        required: ['id', 'title'],
      },
      response: {
        204: {
          type: 'null',
          description: 'No Content',
        },
      },
    },
  }, async (request, reply) => {
    await app.platformatic.entities.movie.save({
      fields: ['id', 'title'],
      input: {
        id: request.params.id,
        title: request.params.title,
      },
    })
    reply.status(204)
  })

  app.get('/hello-world', async (request, reply) => {
    return { hello: 'world' }
  })

  app.get('/hello/:name', {
    schema: {
      params: {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
        required: ['name'],
      },
    },
  }, async (request, reply) => {
    return { hello: request.params.name }
  })

  app.get('/hello/header/name', {
    schema: {
      headers: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          id: { type: 'string' },
        },
        required: ['name'],
      },
    },
  }, async (request, reply) => {
    return { hello: request.headers.name }
  })

  app.post('/weird/:name', {
    schema: {
      params: {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
        required: ['name'],
      },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
      },
    },
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
      },
    },
  })
}
