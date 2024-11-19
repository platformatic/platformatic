'use strict'

import assert from 'node:assert'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { createRuntime, setFixturesDir } from '../../basic/test/helper.js'

process.setMaxListeners(100)

setFixturesDir(resolve(import.meta.dirname, './fixtures'))

test('should allow to setup connection string', async t => {
  const { runtime } = await createRuntime(t, 'node-set-connection-string')

  // The service set:
  // globalThis.platformatic.setOpenapiSchema('TEST_OPEN_API_SCHEMA')
  // globalThis.platformatic.setGraphqlSchema('TEST_GRAPHQL_SCHEMA')
  // globalThis.platformatic.setConnectionString('TEST_CONNECTION_STRING')

  const meta = await runtime.getServiceMeta('api')
  const openapiSchema = await runtime.getServiceOpenapiSchema('api')
  const graphqlSchema = await runtime.getServiceGraphqlSchema('api')
  assert.strictEqual(meta.connectionStrings[0], 'TEST_CONNECTION_STRING')
  assert.strictEqual(openapiSchema, 'TEST_OPEN_API_SCHEMA')
  assert.strictEqual(graphqlSchema, 'TEST_GRAPHQL_SCHEMA')
})
