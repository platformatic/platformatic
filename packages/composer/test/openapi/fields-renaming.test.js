'use strict'

const assert = require('node:assert/strict')
const { tmpdir } = require('node:os')
const { test } = require('node:test')
const { join } = require('node:path')
const { writeFile, mkdtemp } = require('node:fs/promises')
const { default: OpenAPISchemaValidator } = require('openapi-schema-validator')
const {
  createComposer,
  createBasicService,
  createOpenApiService
} = require('../helper')

const openApiValidator = new OpenAPISchemaValidator({ version: 3 })

test('should rename top level object fields', async (t) => {
  const api = await createOpenApiService(t, ['users'])
  await api.listen({ port: 0 })

  const openapiConfig = {
    paths: {
      '/users/{id}': {
        get: {
          responses: {
            200: {
              type: 'object',
              properties: {
                id: { rename: 'user_id' },
                name: { rename: 'first_name' }
              }
            }
          }
        }
      }
    }
  }

  const cwd = await mkdtemp(join(tmpdir(), 'composer-'))
  const openapiConfigFile = join(cwd, 'openapi.json')
  await writeFile(openapiConfigFile, JSON.stringify(openapiConfig))

  const composer = await createComposer(t,
    {
      composer: {
        services: [
          {
            id: 'api1',
            origin: 'http://127.0.0.1:' + api.server.address().port,
            openapi: {
              url: '/documentation/json',
              config: openapiConfigFile
            }
          }
        ]
      }
    }
  )

  const { statusCode, body } = await composer.inject({
    method: 'GET',
    url: '/documentation/json'
  })
  assert.equal(statusCode, 200)

  const openApiSchema = JSON.parse(body)
  openApiValidator.validate(openApiSchema)

  const routeSchema = openApiSchema.paths['/users/{id}'].get
  const responseSchema = routeSchema.responses[200].content['application/json'].schema

  assert.deepEqual(responseSchema, {
    type: 'object',
    title: 'users',
    properties: {
      user_id: { type: 'number' },
      first_name: { type: 'string' }
    }
  })

  {
    const { statusCode, body } = await composer.inject({ method: 'GET', url: '/users/1' })
    assert.equal(statusCode, 200)

    const payload = JSON.parse(body)
    assert.deepEqual(payload, { user_id: 1, first_name: 'test1' })
  }
})

test('should rename nested object fields', async (t) => {
  const api = await createBasicService(t)
  await api.listen({ port: 0 })

  const openapiConfig = {
    paths: {
      '/nested': {
        get: {
          responses: {
            200: {
              type: 'object',
              properties: {
                nested: {
                  type: 'object',
                  properties: {
                    text: { rename: 'renamed_text_filed' }
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  const cwd = await mkdtemp(join(tmpdir(), 'composer-'))
  const openapiConfigFile = join(cwd, 'openapi.json')
  await writeFile(openapiConfigFile, JSON.stringify(openapiConfig))

  const composer = await createComposer(t,
    {
      composer: {
        services: [
          {
            id: 'api1',
            origin: 'http://127.0.0.1:' + api.server.address().port,
            openapi: {
              url: '/documentation/json',
              config: openapiConfigFile
            }
          }
        ]
      }
    }
  )

  const { statusCode, body } = await composer.inject({
    method: 'GET',
    url: '/documentation/json'
  })
  assert.equal(statusCode, 200)

  const openApiSchema = JSON.parse(body)
  openApiValidator.validate(openApiSchema)

  const routeSchema = openApiSchema.paths['/nested'].get
  const responseSchema = routeSchema.responses[200].content['application/json'].schema

  assert.deepEqual(responseSchema, {
    type: 'object',
    properties: {
      nested: {
        type: 'object',
        properties: {
          renamed_text_filed: { type: 'string' }
        }
      }
    }
  })

  {
    const { statusCode, body } = await composer.inject({ method: 'GET', url: '/nested' })
    assert.equal(statusCode, 200)

    const payload = JSON.parse(body)
    assert.deepEqual(payload, { nested: { renamed_text_filed: 'Some text' } })
  }
})

test('should rename property in required array', async (t) => {
  const api = await createBasicService(t)
  await api.listen({ port: 0 })

  const openapiConfig = {
    paths: {
      '/object': {
        get: {
          responses: {
            200: {
              type: 'object',
              properties: {
                text: { rename: 'renamed_text_filed' }
              }
            }
          }
        }
      }
    }
  }

  const cwd = await mkdtemp(join(tmpdir(), 'composer-'))
  const openapiConfigFile = join(cwd, 'openapi.json')
  await writeFile(openapiConfigFile, JSON.stringify(openapiConfig))

  const composer = await createComposer(t,
    {
      composer: {
        services: [
          {
            id: 'api1',
            origin: 'http://127.0.0.1:' + api.server.address().port,
            openapi: {
              url: '/documentation/json',
              config: openapiConfigFile
            }
          }
        ]
      }
    }
  )

  const { statusCode, body } = await composer.inject({
    method: 'GET',
    url: '/documentation/json'
  })
  assert.equal(statusCode, 200)

  const openApiSchema = JSON.parse(body)
  openApiValidator.validate(openApiSchema)

  const routeSchema = openApiSchema.paths['/object'].get
  const responseSchema = routeSchema.responses[200].content['application/json'].schema

  assert.deepEqual(responseSchema, {
    type: 'object',
    properties: {
      renamed_text_filed: { type: 'string' }
    },
    required: ['renamed_text_filed']
  })

  {
    const { statusCode, body } = await composer.inject({ method: 'GET', url: '/object' })
    assert.equal(statusCode, 200)

    const payload = JSON.parse(body)
    assert.deepEqual(payload, { renamed_text_filed: 'Some text' })
  }
})

test('should rename top level object fields in array', async (t) => {
  const api = await createOpenApiService(t, ['users'])
  await api.listen({ port: 0 })

  const openapiConfig = {
    paths: {
      '/users': {
        get: {
          responses: {
            200: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { rename: 'user_id' },
                  name: { rename: 'first_name' }
                }
              }
            }
          }
        }
      }
    }
  }

  const cwd = await mkdtemp(join(tmpdir(), 'composer-'))
  const openapiConfigFile = join(cwd, 'openapi.json')
  await writeFile(openapiConfigFile, JSON.stringify(openapiConfig))

  const composer = await createComposer(t,
    {
      composer: {
        services: [
          {
            id: 'api1',
            origin: 'http://127.0.0.1:' + api.server.address().port,
            openapi: {
              url: '/documentation/json',
              config: openapiConfigFile
            }
          }
        ]
      }
    }
  )

  const { statusCode, body } = await composer.inject({
    method: 'GET',
    url: '/documentation/json'
  })
  assert.equal(statusCode, 200)

  const openApiSchema = JSON.parse(body)
  openApiValidator.validate(openApiSchema)

  const routeSchema = openApiSchema.paths['/users'].get
  const responseSchema = routeSchema.responses[200].content['application/json'].schema

  assert.deepEqual(responseSchema, {
    type: 'array',
    items: {
      title: 'users',
      type: 'object',
      properties: {
        user_id: { type: 'number' },
        first_name: { type: 'string' }
      }
    }
  })

  {
    const { statusCode, body } = await composer.inject({ method: 'GET', url: '/users' })
    assert.equal(statusCode, 200)

    const payload = JSON.parse(body)
    assert.deepEqual(payload, [
      { user_id: 1, first_name: 'test1' },
      { user_id: 2, first_name: 'test2' },
      { user_id: 3, first_name: 'test3' },
      { user_id: 4, first_name: 'test4' }
    ])
  }
})
