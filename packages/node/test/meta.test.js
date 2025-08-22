'use strict'

import assert from 'node:assert'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { createRuntime, setFixturesDir } from '../../basic/test/helper.js'

process.setMaxListeners(100)

setFixturesDir(resolve(import.meta.dirname, './fixtures'))

test('should allow to setup connection string', async t => {
  const { runtime } = await createRuntime(t, 'node-set-connection-string')

  // The application set:
  // globalThis.platformatic.setOpenapiSchema('TEST_OPEN_API_SCHEMA')
  // globalThis.platformatic.setGraphqlSchema('TEST_GRAPHQL_SCHEMA')
  // globalThis.platformatic.setConnectionString('TEST_CONNECTION_STRING')

  const meta = await runtime.getApplicationMeta('api')
  const openapiSchema = await runtime.getApplicationOpenapiSchema('api')
  const graphqlSchema = await runtime.getApplicationGraphqlSchema('api')
  assert.strictEqual(meta.connectionStrings[0], 'TEST_CONNECTION_STRING')
  assert.strictEqual(openapiSchema, 'TEST_OPEN_API_SCHEMA')
  assert.strictEqual(graphqlSchema, 'TEST_GRAPHQL_SCHEMA')
  assert.strictEqual(meta.composer.prefix, 'TEST_BASE_PATH')
})

test('should not have any connections string set', async t => {
  const { runtime } = await createRuntime(t, 'express-api-metrics')
  const meta = await runtime.getApplicationMeta('api')
  assert.deepEqual(meta.connectionStrings, [])
})
