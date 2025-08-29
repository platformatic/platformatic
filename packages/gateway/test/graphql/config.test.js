import assert from 'assert/strict'
import { test } from 'node:test'
import { request } from 'undici'
import { createFromConfig, createGraphqlApplication } from '../helper.js'

function createSampleGraphqlApplication (t) {
  return createGraphqlApplication(t, {
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

test('should get a warning using graphql applications', async t => {
  const messages = []
  const graphql1 = await createSampleGraphqlApplication(t)
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

  const gateway = await createFromConfig(t, {
    server: {
      loggerInstance: logger
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

  await gateway.start({ listen: true })
  assert.ok(messages.includes('graphql composer is an experimental feature'))
})

test('should enable graphiql on gateway', async t => {
  const graphql1 = await createSampleGraphqlApplication(t)
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
          graphql: {
            host: graphql1Host
          }
        }
      ],
      graphql: { graphiql: true }
    }
  })

  const gatewayHost = await gateway.start({ listen: true })

  const res = await request(`${gatewayHost}/graphiql`)
  assert.strictEqual(res.statusCode, 200, '/graphiql response')
})

test('graphiql should be disabled on gateway by default', async t => {
  const graphql1 = await createSampleGraphqlApplication(t)
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
          graphql: {
            host: graphql1Host
          }
        }
      ]
    }
  })

  const gatewayHost = await gateway.start({ listen: true })

  const res = await request(`${gatewayHost}/graphiql`)
  assert.strictEqual(res.statusCode, 404, '/graphiql response')
})
