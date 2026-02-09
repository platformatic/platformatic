import assert from 'node:assert'
import { test } from 'node:test'
import { createFromConfig, createOpenApiApplication } from '../helper.js'

test('get application openapi schema via capability api', async t => {
  const api = await createOpenApiApplication(t, ['users'])
  await api.listen({ port: 0 })

  const config = {
    server: {
      logger: {
        level: 'fatal'
      }
    },
    gateway: {
      applications: [
        {
          id: 'api1',
          origin: 'http://127.0.0.1:' + api.server.address().port,
          openapi: {
            url: '/documentation/json'
          }
        }
      ]
    }
  }

  const capability = await createFromConfig(t, config)
  t.after(() => capability.stop())
  await capability.start({ listen: true })

  const openapiSchema = await capability.getOpenapiSchema()
  assert.strictEqual(openapiSchema.openapi, '3.0.3')
  assert.deepStrictEqual(openapiSchema.info, {
    title: 'Platformatic Gateway',
    version: '1.0.0'
  })

  assert.ok(openapiSchema.paths['/users'].get)
  assert.ok(openapiSchema.paths['/users'].post)
})

test('get null if server does not expose openapi', async t => {
  const config = {
    server: {
      logger: {
        level: 'fatal'
      }
    },

    gateway: {
      applications: []
    }
  }

  const capability = await createFromConfig(t, config)
  t.after(() => capability.stop())
  await capability.start({ listen: true })

  const openapiSchema = await capability.getOpenapiSchema()
  assert.strictEqual(openapiSchema, null)
})
