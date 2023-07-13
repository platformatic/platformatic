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
          title: { type: 'string' }
        },
        required: ['id', 'title']
      },
      response: {
        204: {
          type: 'null',
          description: 'No Content'
        }
      }
    }
  }, async (request, reply) => {
    await app.platformatic.entities.movie.save({
      fields: ['id', 'title'],
      input: {
        id: request.params.id,
        title: request.params.title
      }
    })
    reply.status(204)
  })

  app.post('/movies-201', {
    schema: {
      operationId: 'createMovie201',
      body: {
        $ref: 'Movie'
      },
      response: {
        201: {
          description: 'Movie created successfully',
          content: {
            'application/json': {
              schema: {}
            }
          }
        },
        400: {
          description: 'Validation error',
          content: {
            'application/json': {
              schema: {
                statusCode: { type: 'number', const: 400 },
                error: { type: 'string' },
                message: { type: 'string' }
              }
            }
          }
        }
      }
    }
  },
  async (request, reply) => {
    await app.platformatic.entities.movie.save({
      input: request.body
    })
    reply.status(201)
    return {}
  })

  app.get('/hello-world', async (request, reply) => {
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
