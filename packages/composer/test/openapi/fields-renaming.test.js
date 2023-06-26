'use strict'

const { tmpdir } = require('os')
const { join } = require('path')
const { writeFile, mkdtemp } = require('fs/promises')
const { test } = require('tap')
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
  t.equal(statusCode, 200)

  const openApiSchema = JSON.parse(body)
  openApiValidator.validate(openApiSchema)

  const routeSchema = openApiSchema.paths['/users/{id}'].get
  const responseSchema = routeSchema.responses[200].content['application/json'].schema

  t.strictSame(responseSchema, {
    type: 'object',
    properties: {
      user_id: { type: 'number' },
      first_name: { type: 'string' }
    }
  })

  {
    const { statusCode, body } = await composer.inject({ method: 'GET', url: '/users/1' })
    t.equal(statusCode, 200)

    const payload = JSON.parse(body)
    t.strictSame(payload, { user_id: 1, first_name: 'test1' })
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
  t.equal(statusCode, 200)

  const openApiSchema = JSON.parse(body)
  openApiValidator.validate(openApiSchema)

  const routeSchema = openApiSchema.paths['/nested'].get
  const responseSchema = routeSchema.responses[200].content['application/json'].schema

  t.strictSame(responseSchema, {
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
    t.equal(statusCode, 200)

    const payload = JSON.parse(body)
    t.strictSame(payload, { nested: { renamed_text_filed: 'Some text' } })
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
  t.equal(statusCode, 200)

  const openApiSchema = JSON.parse(body)
  openApiValidator.validate(openApiSchema)

  const routeSchema = openApiSchema.paths['/object'].get
  const responseSchema = routeSchema.responses[200].content['application/json'].schema

  t.strictSame(responseSchema, {
    type: 'object',
    properties: {
      renamed_text_filed: { type: 'string' }
    },
    required: ['renamed_text_filed']
  })

  {
    const { statusCode, body } = await composer.inject({ method: 'GET', url: '/object' })
    t.equal(statusCode, 200)

    const payload = JSON.parse(body)
    t.strictSame(payload, { renamed_text_filed: 'Some text' })
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
  t.equal(statusCode, 200)

  const openApiSchema = JSON.parse(body)
  openApiValidator.validate(openApiSchema)

  const routeSchema = openApiSchema.paths['/users'].get
  const responseSchema = routeSchema.responses[200].content['application/json'].schema

  t.strictSame(responseSchema, {
    type: 'array',
    items: {
      type: 'object',
      properties: {
        user_id: { type: 'number' },
        first_name: { type: 'string' }
      }
    }
  })

  {
    const { statusCode, body } = await composer.inject({ method: 'GET', url: '/users' })
    t.equal(statusCode, 200)

    const payload = JSON.parse(body)
    t.strictSame(payload, [
      { user_id: 1, first_name: 'test1' },
      { user_id: 2, first_name: 'test2' },
      { user_id: 3, first_name: 'test3' },
      { user_id: 4, first_name: 'test4' }
    ])
  }
})
