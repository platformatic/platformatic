import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createFromConfig, createGraphqlApplication } from '../helper.js'

test('graphqlComposerOptions returns only graphql config, graphqlGatewayOptions returns full gateway config', async t => {
  const graphql1 = await createGraphqlApplication(t, {
    schema: 'type Query { hello: String }',
    resolvers: {
      Query: {
        async hello () {
          return 'world'
        }
      }
    }
  })

  const origin = await graphql1.listen()

  const gateway = await createFromConfig(t, {
    server: { logger: { level: 'fatal' } },
    gateway: {
      applications: [{ id: 'graphql1', origin, graphql: true }],
      graphql: { graphiql: true }
    }
  })

  await gateway.start({ listen: true })

  const app = gateway.getApplication()

  // graphqlComposerOptions returns only the graphql config
  assert.strictEqual(app.graphqlComposerOptions.graphiql, true)
  assert.strictEqual(app.graphqlComposerOptions.applications, undefined)

  // graphqlGatewayOptions returns the entire gateway config
  assert.ok(Array.isArray(app.graphqlGatewayOptions.applications))
  assert.ok(app.graphqlGatewayOptions.graphql)
})

test('graphqlComposerOptions returns undefined when no graphql config provided', async t => {
  const graphql1 = await createGraphqlApplication(t, {
    schema: 'type Query { test: String }',
    resolvers: {
      Query: {
        async test () {
          return 'hello'
        }
      }
    }
  })

  const origin = await graphql1.listen()

  let capturedComposerOptions = null

  const gateway = await createFromConfig(t, {
    server: { logger: { level: 'fatal' } },
    gateway: {
      applications: [{ id: 'graphql1', origin, graphql: true }]
    }
  }, async (app, options) => {
    app.register(async function captureDecorators (app) {
      app.addHook('onReady', async () => {
        capturedComposerOptions = app.graphqlComposerOptions
      })
    })
  })

  await gateway.start({ listen: true })

  assert.strictEqual(capturedComposerOptions, undefined)
})
