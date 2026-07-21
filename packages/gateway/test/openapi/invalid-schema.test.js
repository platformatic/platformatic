import fastify from 'fastify'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { createFromConfig, createOpenApiApplication } from '../helper.js'

function buildSchemaWithNullType () {
  // An OpenAPI 3.1-only construct ({ "type": "null" }) inside a document
  // declared as 3.0.x. This is what TypeBox's Type.Union([X, Type.Null()])
  // emits and it makes the whole composed specification invalid.
  return {
    openapi: '3.0.3',
    info: { title: 'Bad API', version: '1.0.0' },
    paths: {
      '/capacity': {
        get: {
          operationId: 'getCapacity',
          responses: {
            200: {
              description: 'OK',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      capacity: { anyOf: [{ type: 'number' }, { type: 'null' }] }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}

async function writeSchemaFile (schema) {
  const cwd = await mkdtemp(join(tmpdir(), 'gateway-'))
  const schemaFile = join(cwd, 'bad-api.openapi.json')
  await writeFile(schemaFile, JSON.stringify(schema))
  return schemaFile
}

async function startGateway (t, applications) {
  const capability = await createFromConfig(t, {
    server: {
      logger: {
        level: 'fatal'
      }
    },
    gateway: { applications }
  })

  await capability.start({ listen: true })
}

test('should name the offending application when a downstream schema file is invalid', async t => {
  const schemaFile = await writeSchemaFile(buildSchemaWithNullType())

  try {
    await startGateway(t, [
      {
        id: 'bad-api',
        origin: 'http://127.0.0.1:1',
        openapi: {
          file: schemaFile
        }
      }
    ])
    assert.fail('should throw error')
  } catch (err) {
    assert.equal(err.code, 'PLT_GATEWAY_INVALID_OPENAPI_SCHEMA')
    assert.match(err.message, /the schema of the "bad-api" application/)
    assert.ok(err.message.includes(schemaFile))
    assert.match(err.message, /declares OpenAPI 3\.0\.3 but uses "type": "null"/)
    assert.ok(err.message.includes('#/paths/~1capacity/get/responses/200/content/application~1json/schema/properties/capacity/anyOf/1/type'))
    assert.match(err.message, /"nullable": true/)
    assert.ok(err.cause)
  }
})

test('should name the offending application when a downstream schema url is invalid', async t => {
  const api = fastify({ keepAliveTimeout: 10, forceCloseConnections: true })
  api.get('/documentation/json', async () => buildSchemaWithNullType())
  await api.listen({ port: 0 })
  t.after(() => api.close())

  const origin = 'http://127.0.0.1:' + api.server.address().port

  try {
    await startGateway(t, [
      {
        id: 'bad-api',
        origin,
        openapi: {
          url: '/documentation/json'
        }
      }
    ])
    assert.fail('should throw error')
  } catch (err) {
    assert.equal(err.code, 'PLT_GATEWAY_INVALID_OPENAPI_SCHEMA')
    assert.match(err.message, /the schema of the "bad-api" application/)
    assert.ok(err.message.includes(origin + '/documentation/json'))
    assert.match(err.message, /declares OpenAPI 3\.0\.3 but uses "type": "null"/)
  }
})

test('should only name the invalid applications when other schemas are valid', async t => {
  const api = await createOpenApiApplication(t, ['users'])
  await api.listen({ port: 0 })

  const schemaFile = await writeSchemaFile(buildSchemaWithNullType())

  try {
    await startGateway(t, [
      {
        id: 'valid-api',
        origin: 'http://127.0.0.1:' + api.server.address().port,
        openapi: {
          url: '/documentation/json'
        }
      },
      {
        id: 'bad-api',
        origin: 'http://127.0.0.1:1',
        openapi: {
          file: schemaFile
        }
      }
    ])
    assert.fail('should throw error')
  } catch (err) {
    assert.equal(err.code, 'PLT_GATEWAY_INVALID_OPENAPI_SCHEMA')
    assert.match(err.message, /the schema of the "bad-api" application/)
    assert.ok(!err.message.includes('valid-api'))
  }
})

test('should report the validation errors when the schema is invalid for other reasons', async t => {
  const schema = buildSchemaWithNullType()
  schema.paths['/capacity'].get.responses[200].content['application/json'].schema = {
    type: 'not-a-type'
  }
  const schemaFile = await writeSchemaFile(schema)

  try {
    await startGateway(t, [
      {
        id: 'bad-api',
        origin: 'http://127.0.0.1:1',
        openapi: {
          file: schemaFile
        }
      }
    ])
    assert.fail('should throw error')
  } catch (err) {
    assert.equal(err.code, 'PLT_GATEWAY_INVALID_OPENAPI_SCHEMA')
    assert.match(err.message, /the schema of the "bad-api" application/)
    assert.match(err.message, /\/paths\/~1capacity\/get\/responses\/200/)
  }
})
