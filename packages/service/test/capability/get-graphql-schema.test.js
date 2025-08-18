import assert from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { create } from '../../index.js'
import { createFromConfig } from '../helper.js'

test('get service openapi schema via capability api', async t => {
  const capability = await createFromConfig(t, {
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
      paths: [join(import.meta.dirname, '..', 'fixtures', 'hello-world-resolver.js')]
    },
    watch: false
  })
  t.after(() => capability.stop())
  await capability.start({ listen: true })

  const graphqlSchema = await capability.getGraphqlSchema()
  assert.strictEqual(graphqlSchema, 'type Query {\n  hello: String\n}')
})

test('get null if server does not expose graphql', async t => {
  const capability = await create(join(import.meta.dirname, '..', 'fixtures', 'directories'))
  t.after(() => capability.stop())
  await capability.start({ listen: true })

  const graphqlSchema = await capability.getGraphqlSchema()
  assert.strictEqual(graphqlSchema, null)
})
