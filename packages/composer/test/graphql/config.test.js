'use strict'

const assert = require('assert/strict')
const { test } = require('node:test')
const { request } = require('undici')

const { createComposer, createGraphqlService, createLoggerSpy } = require('../helper')

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

test('should get a warning using graphql services', async t => {
  const graphql1 = await createSampleGraphqlService(t)
  const logger = createLoggerSpy()

  const graphql1Host = await graphql1.listen()

  const composer = await createComposer(t,
    {
      composer: {
        services: [
          {
            id: 'graphql1',
            origin: graphql1Host,
            graphql: true
          }
        ]
      }
    },
    logger
  )

  await composer.start()

  assert.ok(logger._warn.find(l => l[0] === 'graphql composer is an experimental feature'))
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
              host: graphql1Host
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
              host: graphql1Host
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
