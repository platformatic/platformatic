'use strict'

const assert = require('assert/strict')
const { test } = require('node:test')
const { join } = require('node:path')

const { createComposer, createGraphqlService } = require('./helper')

test('should get graphiql and openapi state', async (t) => {
  const graphql1 = await createGraphqlService(t, {
    schema: 'type Query { hello: String }',
    resolvers: { Query: { hello: () => 'ok' } }
  })
  const graphql1Host = await graphql1.listen()

  const cases = []
  for (const graphiql of [true, false]) {
    for (const openapi of [true, false]) {
      cases.push({ config: { graphiql, openapi } })
    }
  }

  for (const { config } of cases) {
    const c = {
      composer: {
        graphql: { graphiql: config.graphiql },
        services: [
          {
            id: 'graphql',
            origin: graphql1Host,
            graphql: true
          }
        ],
        refreshTimeout: 0
      }
    }

    if (config.openapi) {
      c.composer.services.push({
        id: 'openapi',
        origin: 'http://openapi.plt.local',
        openapi: { file: join(__dirname, 'openapi', 'fixtures', 'schemas', 'users.json') }
      })
    }

    const composer = await createComposer(t, c)

    const { statusCode, body } = await composer.inject({
      method: 'GET',
      url: '/_platformatic_versions'
    })

    assert.strictEqual(statusCode, 200)
    assert.deepStrictEqual(JSON.parse(body), { graphiql: config.graphiql, openapi: config.openapi })
  }
})
