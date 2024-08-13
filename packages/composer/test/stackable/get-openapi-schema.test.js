'use strict'

const assert = require('node:assert')
const { test } = require('node:test')
const { buildStackable } = require('../..')
const { createOpenApiService } = require('../helper')

test('get service openapi schema via stackable api', async (t) => {
  const api = await createOpenApiService(t, ['users'])
  await api.listen({ port: 0 })

  const config = {
    composer: {
      services: [
        {
          id: 'api1',
          origin: 'http://127.0.0.1:' + api.server.address().port,
          openapi: {
            url: '/documentation/json',
          },
        },
      ],
    },
  }

  const stackable = await buildStackable({ config })

  t.after(async () => {
    await stackable.stop()
  })
  await stackable.start()

  const openapiSchema = await stackable.getOpenAPISchema()
  assert.strictEqual(openapiSchema.openapi, '3.0.3')
  assert.deepStrictEqual(openapiSchema.info, {
    title: 'Platformatic Composer',
    version: '1.0.0',
  })

  assert.ok(openapiSchema.paths['/users'].get)
  assert.ok(openapiSchema.paths['/users'].post)
})

test('get null if server does not expose openapi', async (t) => {
  const config = {
    composer: {
      services: [],
    },
  }

  const stackable = await buildStackable({ config })
  t.after(async () => {
    await stackable.stop()
  })
  await stackable.start()

  const openapiSchema = await stackable.getOpenAPISchema()
  assert.strictEqual(openapiSchema, null)
})
