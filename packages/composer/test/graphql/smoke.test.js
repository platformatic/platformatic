'use strict'

const assert = require('assert/strict')
const { test } = require('node:test')

const { createComposer, createGraphqlService, graphqlRequest } = require('../helper')

test('should start composer with a graphql service', async t => {
  const graphql1 = await createGraphqlService(t, {
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
    }
  )

  const composerHost = await composer.listen()

  const query = '{ add (x: 2, y: 2) }'

  {
    const response = await graphqlRequest({ query, host: graphql1Host })
    assert.deepEqual(response, { add: 4 })
  }

  {
    const response = await graphqlRequest({ query, host: composerHost })
    assert.deepEqual(response, { add: 4 })
  }
})

test('should start composer with two graphql services', async t => {
  const graphql1 = await createGraphqlService(t, {
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

  const graphql2 = await createGraphqlService(t, {
    schema: `
    type Query {
      mul(x: Int, y: Int): Int
    }`,
    resolvers: {
      Query: {
        async mul (_, { x, y }) {
          return x * y
        }
      }
    }
  })

  const graphql1Host = await graphql1.listen()
  const graphql2Host = await graphql2.listen()

  const composer = await createComposer(t,
    {
      composer: {
        services: [
          {
            id: 'graphql1',
            origin: graphql1Host,
            graphql: true
          },
          {
            id: 'graphql2',
            origin: graphql2Host,
            graphql: true
          }
        ]
      }
    }
  )

  const composerHost = await composer.listen()

  {
    const query = '{ add (x: 3, y: 4) }'
    {
      const response = await graphqlRequest({ query, host: graphql1Host })
      assert.deepEqual(response, { add: 7 })
    }
    {
      const response = await graphqlRequest({ query, host: composerHost })
      assert.deepEqual(response, { add: 7 })
    }
  }

  {
    const query = '{ mul (x: 5, y: 6) }'
    {
      const response = await graphqlRequest({ query, host: graphql2Host })
      assert.deepEqual(response, { mul: 30 })
    }
    {
      const response = await graphqlRequest({ query, host: composerHost })
      assert.deepEqual(response, { mul: 30 })
    }
  }
})
