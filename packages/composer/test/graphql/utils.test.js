'use strict'

const assert = require('assert/strict')
const { test } = require('node:test')
const { serviceToSubgraphConfig } = require('../../lib/graphql-fetch')

test('serviceToSubgraphConfig unit test', t => {
  const cases = [
    { label: 'empty service', service: {}, expected: undefined },
    {
      label: 'default graphql service',
      service: {
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
    }
  ]

  for (const c of cases) {
    assert.deepEqual(serviceToSubgraphConfig(c.service), c.expected, c.label)
  }
})
