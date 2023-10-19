'use strict'

const path = require('path')
const assert = require('assert/strict')
const { test } = require('node:test')
const { request } = require('undici')

const { createComposer, createGraphqlService, graphqlRequest } = require('../helper')

function createSampleGraphqlService (t) {
  return createGraphqlService(t, {
    schema: `
    type Query {
      add(x: Int, y: Int): Int
    }`,
    resolvers: {
      Query: {
        async add (_, { x, y }) {
          return x + y
        }
      }
    }
  })
}

test('should start composer with two graphql services, from service and from file', async t => {
  const graphql1 = await createSampleGraphqlService(t)
  const graphql1Host = await graphql1.listen()

  const composer = await createComposer(t,
    {
      composer: {
        services: [
          {
            id: 'graphql1',
            graphql: {
              url: graphql1Host
            }
          },
          {
            id: 'graphql2',
            graphql: {
              file: path.join(__dirname, 'fixtures', 'hello.js')
            }
          }
        ]
      }
    }
  )

  const composerHost = await composer.listen()

  {
    const query = '{ add (x: 3, y: 4) }'
    const response = await graphqlRequest({ query, host: composerHost })
    assert.deepEqual(response, { add: 7 })
  }

  {
    const query = '{ hello }'
    const response = await graphqlRequest({ query, host: composerHost })
    assert.deepEqual(response, { hello: 'world' })
  }
})

test('should enable graphiql on composer', async t => {
  const graphql1 = await createSampleGraphqlService(t)
  const graphql1Host = await graphql1.listen()

  const composer = await createComposer(t,
    {
      composer: {
        services: [
          {
            id: 'graphql1',
            graphql: {
              url: graphql1Host
            }
          }
        ],
        graphql: { graphiql: true }
      }
    }
  )

  const composerHost = await composer.listen()

  const res = await request(`${composerHost}/graphiql`)
  assert.strictEqual(res.statusCode, 200, '/graphiql response')
})

test('graphiql should be disabled on composer by default', async t => {
  const graphql1 = await createSampleGraphqlService(t)
  const graphql1Host = await graphql1.listen()

  const composer = await createComposer(t,
    {
      composer: {
        services: [
          {
            id: 'graphql1',
            graphql: {
              url: graphql1Host
            }
          }
        ]
      }
    }
  )

  const composerHost = await composer.listen()

  const res = await request(`${composerHost}/graphiql`)
  assert.strictEqual(res.statusCode, 404, '/graphiql response')
})
