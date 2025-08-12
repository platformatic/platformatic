'use strict'

const assert = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')

const { createRuntime } = require('../helpers.js')
const fixturesDir = join(__dirname, '..', '..', 'fixtures')

test('should get a service openapi schema', async t => {
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')
  const app = await createRuntime(configFile)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  const openapiSchema = await app.getServiceOpenapiSchema('with-logger')
  assert.deepStrictEqual(openapiSchema, {
    openapi: '3.0.3',
    info: {
      title: 'Platformatic',
      description: 'This is a service built on top of Platformatic',
      version: '1.0.0'
    },
    servers: [{ url: '/' }],
    components: { schemas: {} },
    paths: {
      '/': {
        get: {
          responses: {
            200: {
              description: 'Default Response'
            }
          }
        }
      }
    }
  })
})

test('should fail to get a service openapi schema if service does not expose it', async t => {
  const configFile = join(fixturesDir, 'configs', 'monorepo-openapi.json')
  const app = await createRuntime(configFile)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  const openapiSchema = await app.getServiceOpenapiSchema('without-openapi')
  assert.strictEqual(openapiSchema, null)
})
