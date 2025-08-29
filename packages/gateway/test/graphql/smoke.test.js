import assert from 'assert/strict'
import { test } from 'node:test'
import { createFromConfig, createGraphqlApplication, graphqlRequest } from '../helper.js'

test('should start gateway with a graphql application', async t => {
  const graphql1 = await createGraphqlApplication(t, {
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

  const gateway = await createFromConfig(t, {
    server: {
      logger: {
        level: 'fatal'
      }
    },
    gateway: {
      applications: [
        {
          id: 'graphql1',
          origin: graphql1Host,
          graphql: true
        }
      ]
    }
  })

  const gatewayHost = await gateway.start({ listen: true })

  const query = '{ add (x: 2, y: 2) }'

  {
    const response = await graphqlRequest({ query, host: graphql1Host })
    assert.deepEqual(response, { add: 4 })
  }

  {
    const response = await graphqlRequest({ query, host: gatewayHost })
    assert.deepEqual(response, { add: 4 })
  }
})

test('should start gateway with two graphql applications', async t => {
  const graphql1 = await createGraphqlApplication(t, {
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

  const graphql2 = await createGraphqlApplication(t, {
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

  const gateway = await createFromConfig(t, {
    server: {
      logger: {
        level: 'fatal'
      }
    },
    gateway: {
      applications: [
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
  })

  const gatewayHost = await gateway.start({ listen: true })

  {
    const query = '{ add (x: 3, y: 4) }'
    {
      const response = await graphqlRequest({ query, host: graphql1Host })
      assert.deepEqual(response, { add: 7 })
    }
    {
      const response = await graphqlRequest({ query, host: gatewayHost })
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
      const response = await graphqlRequest({ query, host: gatewayHost })
      assert.deepEqual(response, { mul: 30 })
    }
  }
})
