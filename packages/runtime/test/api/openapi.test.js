import { deepStrictEqual, strictEqual } from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { createRuntime } from '../helpers.js'

const fixturesDir = join(import.meta.dirname, '..', '..', 'fixtures')

test('should get a application openapi schema', async t => {
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')
  const app = await createRuntime(configFile)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  const openapiSchema = await app.getApplicationOpenapiSchema('with-logger')
  deepStrictEqual(openapiSchema, {
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

test('should fail to get a application openapi schema if application does not expose it', async t => {
  const configFile = join(fixturesDir, 'configs', 'monorepo-openapi.json')
  const app = await createRuntime(configFile)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  const openapiSchema = await app.getApplicationOpenapiSchema('without-openapi')
  strictEqual(openapiSchema, null)
})
