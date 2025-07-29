import assert from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { create } from '../../index.js'
import { createFromConfig } from '../helper.js'

test('get service openapi schema via stackable api', async t => {
  const stackable = await createFromConfig(t, {
    server: {
      hostname: '127.0.0.1',
      port: 0,
      logger: {
        level: 'error'
      }
    },
    service: {
      openapi: true
    },
    plugins: {
      paths: [join(import.meta.dirname, '..', 'fixtures', 'directories', 'routes')]
    },
    watch: false
  })

  t.after(() => stackable.stop())
  await stackable.start({ listen: true })

  const openapiSchema = await stackable.getOpenapiSchema()
  assert.strictEqual(openapiSchema.openapi, '3.0.3')
  assert.deepStrictEqual(openapiSchema.info, {
    description: 'This is a service built on top of Platformatic',
    title: 'Platformatic',
    version: '1.0.0'
  })
  assert.deepStrictEqual(openapiSchema.paths['/foo/baz/'], {
    get: {
      responses: {
        200: {
          description: 'Default Response'
        }
      }
    }
  })
})

test('get null if server does not expose openapi', async t => {
  const stackable = await create(join(import.meta.dirname, '..', 'fixtures', 'directories'))
  t.after(() => stackable.stop())
  await stackable.start({ listen: true })

  const openapiSchema = await stackable.getOpenapiSchema()
  assert.strictEqual(openapiSchema, null)
})
