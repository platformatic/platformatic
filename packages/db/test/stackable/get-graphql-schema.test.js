'use strict'

const assert = require('node:assert/strict')
const { test } = require('node:test')
const { join } = require('node:path')
const { createFromConfig, getConnectionInfo } = require('../helper')

test('get service graphql schema via stackable api', async t => {
  const workingDir = join(__dirname, '..', 'fixtures', 'directories')
  const { connectionInfo, dropTestDB } = await getConnectionInfo()

  const stackable = await createFromConfig(t, {
    server: {
      hostname: '127.0.0.1',
      port: 0,
      logger: { level: 'fatal' }
    },
    db: {
      ...connectionInfo
    },
    plugins: {
      paths: [join(workingDir, 'routes')]
    },
    watch: false,
    metrics: false
  })

  t.after(async () => {
    await stackable.stop()
    await dropTestDB()
  })
  await stackable.start({ listen: true })

  const graphqlSchema = await stackable.getGraphqlSchema()
  assert.strictEqual(graphqlSchema, 'type Query {\n  hello: String\n}')
})

test('get null if server does not expose graphql', async t => {
  const workingDir = join(__dirname, '..', 'fixtures', 'directories')
  const { connectionInfo, dropTestDB } = await getConnectionInfo()

  const stackable = await createFromConfig(t, {
    server: {
      hostname: '127.0.0.1',
      port: 0,
      logger: { level: 'fatal' }
    },
    db: {
      graphql: false,
      ...connectionInfo
    },
    plugins: {
      paths: [join(workingDir, 'routes')]
    },
    watch: false,
    metrics: false
  })

  t.after(async () => {
    await stackable.stop()
    await dropTestDB()
  })
  await stackable.start({ listen: true })

  const graphqlSchema = await stackable.getGraphqlSchema()
  assert.strictEqual(graphqlSchema, null)
})
