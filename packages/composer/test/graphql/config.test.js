'use strict'

const assert = require('assert/strict')
const { test } = require('node:test')
const { request } = require('undici')

const { createStackableFromConfig, createGraphqlService } = require('../helper')

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
  const messages = []
  const graphql1 = await createSampleGraphqlService(t)
  const logger = {
    warn: msg => {
      messages.push(msg)
    },
    error: () => {},
    info: () => {},
    debug: () => {},
    fatal: () => {},
    trace: () => {},
    child: () => logger
  }

  const graphql1Host = await graphql1.listen()

  const composer = await createStackableFromConfig(t, {
    server: {
      loggerInstance: logger
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
  })

  await composer.start({ listen: true })
  assert.ok(messages.includes('graphql composer is an experimental feature'))
})

test('should enable graphiql on composer', async t => {
  const graphql1 = await createSampleGraphqlService(t)
  const graphql1Host = await graphql1.listen()

  const composer = await createStackableFromConfig(t, {
    server: {
      logger: {
        level: 'fatal'
      }
    },
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
  })

  const composerHost = await composer.start({ listen: true })

  const res = await request(`${composerHost}/graphiql`)
  assert.strictEqual(res.statusCode, 200, '/graphiql response')
})

test('graphiql should be disabled on composer by default', async t => {
  const graphql1 = await createSampleGraphqlService(t)
  const graphql1Host = await graphql1.listen()

  const composer = await createStackableFromConfig(t, {
    server: {
      logger: {
        level: 'fatal'
      }
    },
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
  })

  const composerHost = await composer.start({ listen: true })

  const res = await request(`${composerHost}/graphiql`)
  assert.strictEqual(res.statusCode, 404, '/graphiql response')
})
