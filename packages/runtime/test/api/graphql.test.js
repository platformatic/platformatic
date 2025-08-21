'use strict'

const assert = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')

const { createRuntime } = require('../helpers.js')
const fixturesDir = join(__dirname, '..', '..', 'fixtures')

test('should get a application graphql schema', async t => {
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')
  const app = await createRuntime(configFile)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  const graphqlSchema = await app.getApplicationGraphqlSchema('db-app')
  assert.deepStrictEqual(graphqlSchema, 'type Query {\n  hello: String\n}')
})

test('should fail to get a application graphql schema if application does not expose it', async t => {
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')
  const app = await createRuntime(configFile)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  const graphqlSchema = await app.getApplicationGraphqlSchema('with-logger')
  assert.strictEqual(graphqlSchema, null)
})
