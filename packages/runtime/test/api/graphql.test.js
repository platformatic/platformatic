import { deepStrictEqual, strictEqual } from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { createRuntime } from '../helpers.js'

const fixturesDir = join(import.meta.dirname, '..', '..', 'fixtures')

test('should get a application graphql schema', async t => {
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')
  const app = await createRuntime(configFile)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  const graphqlSchema = await app.getApplicationGraphqlSchema('db-app')
  deepStrictEqual(graphqlSchema, 'type Query {\n  hello: String\n}')
})

test('should fail to get a application graphql schema if application does not expose it', async t => {
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')
  const app = await createRuntime(configFile)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  const graphqlSchema = await app.getApplicationGraphqlSchema('with-logger')
  strictEqual(graphqlSchema, null)
})
