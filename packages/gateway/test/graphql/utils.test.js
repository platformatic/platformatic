import assert from 'assert/strict'
import { test } from 'node:test'
import { applicationToSubgraphConfig } from '../../lib/graphql-fetch.js'

test('applicationToSubgraphConfig unit test', t => {
  const cases = [
    { label: 'empty application', application: {}, expected: undefined },
    {
      label: 'default graphql application',
      application: {
        origin: 'http://origin',
        graphql: {
          composeEndpoint: '/introspection',
          graphqlEndpoint: '/graphql'
        }
      },
      expected: {
        name: 'http://origin',
        entities: undefined,
        server: {
          host: 'http://origin',
          composeEndpoint: '/introspection',
          graphqlEndpoint: '/graphql'
        }
      }
    },
    {
      label: 'graphql application from file',
      application: {
        id: 'application',
        origin: 'http://origin',
        graphql: {
          file: '/to/schema.graphql',
          graphqlEndpoint: '/graphql'
        }
      },
      sdl: 'type Query { hello: String }',
      expected: {
        name: 'application',
        entities: undefined,
        sdl: 'type Query { hello: String }',
        server: {
          host: 'http://origin',
          composeEndpoint: undefined,
          graphqlEndpoint: '/graphql'
        }
      }
    }
  ]

  for (const c of cases) {
    assert.deepEqual(applicationToSubgraphConfig(c.application, c.sdl), c.expected, c.label)
  }
})
