import assert from 'node:assert'
import { test } from 'node:test'
import { createFromConfig, createGraphqlApplication } from '../helper.js'

test('should start composer with a graphql application', async t => {
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

  const config = {
    server: {
      logger: {
        level: 'fatal'
      }
    },

    composer: {
      applications: [
        {
          id: 'graphql1',
          origin: graphql1Host,
          graphql: true
        }
      ]
    }
  }

  const capability = await createFromConfig(t, config)
  t.after(() => capability.stop())
  await capability.start({ listen: true })

  const graphqlSchema = await capability.getGraphqlSchema()
  assert.strictEqual(graphqlSchema, 'type Query {\n  add(x: Int, y: Int): Int\n}')
})

test('get null if server does not expose openapi', async t => {
  const config = {
    server: {
      logger: {
        level: 'fatal'
      }
    },

    composer: {
      applications: []
    }
  }

  const capability = await createFromConfig(t, config)
  t.after(() => capability.stop())
  await capability.start({ listen: true })

  const openapiSchema = await capability.getGraphqlSchema()
  assert.strictEqual(openapiSchema, null)
})
