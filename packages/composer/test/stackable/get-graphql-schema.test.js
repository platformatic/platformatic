'use strict'

const assert = require('node:assert')
const { test } = require('node:test')
const { createGraphqlService, createFromConfig } = require('../helper')

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

  const config = {
    server: {
      logger: {
        level: 'fatal'
      }
    },

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

  const stackable = await createFromConfig(t, config)
  t.after(() => stackable.stop())
  await stackable.start({ listen: true })

  const graphqlSchema = await stackable.getGraphqlSchema()
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
      services: []
    }
  }

  const stackable = await createFromConfig(t, config)
  t.after(() => stackable.stop())
  await stackable.start({ listen: true })

  const openapiSchema = await stackable.getGraphqlSchema()
  assert.strictEqual(openapiSchema, null)
})
