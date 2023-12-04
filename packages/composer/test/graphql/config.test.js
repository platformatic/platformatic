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

test('should throw an error on invalid config / defaultArgsAdapter', async t => {
  assert.rejects(async () => {
    await createComposer(t,
      {
        composer: {
          graphql: {
            defaultArgsAdapter: 'not-a-function'
          },
          services: [
            {
              id: 'graphql1',
              graphql: true
            }
          ]
        }
      }
    )
  }, (err) => {
    assert.strictEqual(err.message, 'Validation errors: "defaultArgsAdapter" shoud be a function. {"defaultArgsAdapter":"not-a-function"}')
    return true
  })
})

test('should throw an error on invalid config / entities', async t => {
  assert.rejects(async () => {
    await createComposer(t,
      {
        composer: {
          services: [
            {
              id: 'graphql1',
              graphql: {
                entities: {
                  Dogs: {
                    pkey: -1,
                    resolver: {
                      name: ['theResolver'],
                      argsAdapter: 'not-a-function'
                    }
                  }
                }
              }
            }
          ]
        }
      }
    )
  }, (err) => {
    assert.match(err.message, /Validation errors:/)
    assert.match(err.message, /"argsAdapter" shoud be a function/)
    return true
  })
})
