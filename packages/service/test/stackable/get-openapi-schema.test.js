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
      openapi: true,
    },
    plugins: {
      paths: [join(__dirname, '..', 'fixtures', 'directories', 'routes')],
    },
    watch: false,
    metrics: false,
  }

  const { stackable } = await buildStackable(config)
  t.after(async () => {
    await stackable.stop()
  })
  await stackable.start()

  const openapiSchema = await stackable.getOpenapiSchema()
  assert.strictEqual(openapiSchema.openapi, '3.0.3')
  assert.deepStrictEqual(openapiSchema.info, {
    description: 'This is a service built on top of Platformatic',
    title: 'Platformatic',
    version: '1.0.0',
  })
  assert.deepStrictEqual(openapiSchema.paths['/foo/baz/'], {
    get: {
      responses: {
        200: {
          description: 'Default Response',
        },
      },
    },
  })
})

test('get null if server does not expose openapi', async (t) => {
  const config = {
    server: {
      hostname: '127.0.0.1',
      port: 0,
    },
    service: {
      openapi: false,
    },
    plugins: {
      paths: [join(__dirname, '..', 'fixtures', 'directories', 'routes')],
    },
    watch: false,
    metrics: false,
  }

  const { stackable } = await buildStackable(config)
  t.after(async () => {
    await stackable.stop()
  })
  await stackable.start()

  const openapiSchema = await stackable.getOpenapiSchema()
  assert.strictEqual(openapiSchema, null)
})
