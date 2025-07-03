'use strict'

const assert = require('node:assert')
const { test } = require('node:test')
const { join } = require('node:path')
const { create } = require('../..')
const { createFromConfig } = require('../helper')

test('get service openapi schema via stackable api', async t => {
  const stackable = await createFromConfig(t, {
    server: {
      hostname: '127.0.0.1',
      port: 0,
      logger: {
        level: 'fatal'
      }
    },
    service: {
      graphql: true
    },
    plugins: {
      paths: [join(__dirname, '..', 'fixtures', 'hello-world-resolver.js')]
    },
    watch: false
  })
  t.after(() => stackable.stop())
  await stackable.start({ listen: true })

  const graphqlSchema = await stackable.getGraphqlSchema()
  assert.strictEqual(graphqlSchema, 'type Query {\n  hello: String\n}')
})

test('get null if server does not expose graphql', async t => {
  const stackable = await create(join(__dirname, '..', 'fixtures', 'directories'))
  t.after(() => stackable.stop())
  await stackable.start({ listen: true })

  const graphqlSchema = await stackable.getGraphqlSchema()
  assert.strictEqual(graphqlSchema, null)
})
