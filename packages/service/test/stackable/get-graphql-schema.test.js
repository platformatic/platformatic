'use strict'

const assert = require('node:assert')
const { test } = require('node:test')
const { join } = require('node:path')
const { buildStackable } = require('../..')

test('get service openapi schema via stackable api', async (t) => {
  const config = {
    server: {
      hostname: '127.0.0.1',
      port: 0,
    },
    service: {
      graphql: true,
    },
    plugins: {
      paths: [join(__dirname, '..', 'fixtures', 'hello-world-resolver.js')],
    },
    watch: false,
    metrics: false,
  }

  const stackable = await buildStackable({ config })
  t.after(async () => {
    await stackable.stop()
  })

  await stackable.init()
  await stackable.start()

  const graphqlSchema = await stackable.getGraphQLSchema()
  assert.strictEqual(graphqlSchema, 'type Query {\n  hello: String\n}')
})

test('get null if server does not expose graphql', async (t) => {
  const config = {
    server: {
      hostname: '127.0.0.1',
      port: 0,
    },
    service: {
      graphql: false,
    },
    plugins: {
      paths: [join(__dirname, '..', 'fixtures', 'directories', 'routes')],
    },
    watch: false,
    metrics: false,
  }

  const stackable = await buildStackable({ config })
  t.after(async () => {
    await stackable.stop()
  })
  await stackable.start()

  const graphqlSchema = await stackable.getGraphQLSchema()
  assert.strictEqual(graphqlSchema, null)
})
