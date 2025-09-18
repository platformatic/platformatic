import assert from 'node:assert/strict'
import { join } from 'node:path'
import { test } from 'node:test'
import openAPISchemaValidator from 'openapi-schema-validator'
import { request } from 'undici'
import { createBasicApplication, createFromConfig, createOpenApiApplication, testEntityRoutes } from '../helper.js'

const OpenAPISchemaValidator = openAPISchemaValidator.default
const openApiValidator = new OpenAPISchemaValidator({ version: 3 })

test('should compose openapi with prefixes', async t => {
  const api1 = await createOpenApiApplication(t, ['users'])
  const api2 = await createOpenApiApplication(t, ['posts'])

  await api1.listen({ port: 0 })
  await api2.listen({ port: 0 })

  const gateway = await createFromConfig(t, {
    server: {
      logger: {
        level: 'fatal'
      }
    },
    gateway: {
      applications: [
        {
          id: 'api1',
          origin: 'http://127.0.0.1:' + api1.server.address().port,
          openapi: {
            url: '/documentation/json',
            prefix: '/api1'
          }
        },
        {
          id: 'api2',
          origin: 'http://127.0.0.1:' + api2.server.address().port,
          openapi: {
            url: '/documentation/json',
            prefix: '/api2'
          }
        }
      ]
    }
  })

  const gatewayOrigin = await gateway.start({ listen: true })

  const { statusCode, body } = await gateway.inject({
    method: 'GET',
    url: '/documentation/json'
  })
  assert.equal(statusCode, 200)

  const openApiSchema = JSON.parse(body)
  openApiValidator.validate(openApiSchema)

  await testEntityRoutes(gatewayOrigin, ['/api1/users', '/api2/posts'])
})

test('should compose openapi without prefixes', async t => {
  const api1 = await createOpenApiApplication(t, ['users'])
  const api2 = await createOpenApiApplication(t, ['posts'])

  await api1.listen({ port: 0 })
  await api2.listen({ port: 0 })

  const gateway = await createFromConfig(t, {
    server: {
      logger: {
        level: 'fatal'
      }
    },
    gateway: {
      applications: [
        {
          id: 'api1',
          origin: 'http://127.0.0.1:' + api1.server.address().port,
          openapi: {
            url: '/documentation/json'
          }
        },
        {
          id: 'api2',
          origin: 'http://127.0.0.1:' + api2.server.address().port,
          openapi: {
            url: '/documentation/json'
          }
        }
      ]
    }
  })

  const gatewayOrigin = await gateway.start({ listen: true })

  const { statusCode, body } = await gateway.inject({
    method: 'GET',
    url: '/documentation/json'
  })
  assert.equal(statusCode, 200)

  const openApiSchema = JSON.parse(body)
  openApiValidator.validate(openApiSchema)

  await testEntityRoutes(gatewayOrigin, ['/users', '/posts'])
})

test('should read schemas from disk and compose openapi', async t => {
  const api1 = await createOpenApiApplication(t, ['users'])
  const api2 = await createOpenApiApplication(t, ['posts'])

  await api1.listen({ port: 0 })
  await api2.listen({ port: 0 })

  const gateway = await createFromConfig(t, {
    server: {
      logger: {
        level: 'fatal'
      }
    },
    gateway: {
      applications: [
        {
          id: 'api1',
          origin: 'http://127.0.0.1:' + api1.server.address().port,
          openapi: {
            url: '/documentation/json'
          }
        },
        {
          id: 'api2',
          origin: 'http://127.0.0.1:' + api2.server.address().port,
          openapi: {
            url: '/documentation/json'
          }
        }
      ]
    }
  })

  const gatewayOrigin = await gateway.start({ listen: true })

  const { statusCode, body } = await gateway.inject({
    method: 'GET',
    url: '/documentation/json'
  })
  assert.equal(statusCode, 200)

  const openApiSchema = JSON.parse(body)
  openApiValidator.validate(openApiSchema)

  await testEntityRoutes(gatewayOrigin, ['/users', '/posts'])
})

test('should not proxy request if it is not in a schema file', async t => {
  const api1 = await createOpenApiApplication(t, ['users'])
  const api2 = await createOpenApiApplication(t, ['posts'])

  api1.get('/not-in-the-schema', async () => {
    assert.fail('should not proxy request')
  })

  await api1.listen({ port: 0 })
  await api2.listen({ port: 0 })

  const gateway = await createFromConfig(t, {
    server: {
      logger: {
        level: 'fatal'
      }
    },
    gateway: {
      applications: [
        {
          id: 'api1',
          origin: 'http://127.0.0.1:' + api1.server.address().port,
          openapi: {
            file: join(import.meta.dirname, 'fixtures', 'schemas', 'users.json')
          }
        },
        {
          id: 'api2',
          origin: 'http://127.0.0.1:' + api2.server.address().port,
          openapi: {
            file: join(import.meta.dirname, 'fixtures', 'schemas', 'posts.json')
          }
        }
      ]
    }
  })

  const gatewayOrigin = await gateway.start({ listen: true })

  const { statusCode, body } = await gateway.inject({
    method: 'GET',
    url: '/documentation/json'
  })
  assert.equal(statusCode, 200)

  const openApiSchema = JSON.parse(body)
  openApiValidator.validate(openApiSchema)

  assert.ok(!openApiSchema.paths['/not-in-the-schema'], 'should not have the path in the schema')

  await testEntityRoutes(gatewayOrigin, ['/users', '/posts'])

  {
    const { statusCode } = await gateway.inject({
      method: 'GET',
      url: '/not-in-the-schema'
    })
    assert.equal(statusCode, 404)
  }
})

test('should automatically compose API with application id as prefix if there is no openapi nor graphql config', async t => {
  const api1 = await createOpenApiApplication(t, ['users'])
  const api2 = await createOpenApiApplication(t, ['posts'])

  await api1.listen({ port: 0 })
  await api2.listen({ port: 0 })

  const gateway = await createFromConfig(t, {
    server: {
      logger: {
        level: 'fatal'
      }
    },
    gateway: {
      applications: [
        {
          id: 'api1',
          origin: 'http://127.0.0.1:' + api1.server.address().port,
          openapi: {
            url: '/documentation/json',
            prefix: '/api1'
          }
        },
        {
          id: 'api2',
          origin: 'http://127.0.0.1:' + api2.server.address().port
        }
      ]
    }
  })

  const gatewayOrigin = await gateway.start({ listen: true })

  const { statusCode, body } = await gateway.inject({
    method: 'GET',
    url: '/documentation/json'
  })
  assert.equal(statusCode, 200)

  const openApiSchema = JSON.parse(body)
  openApiValidator.validate(openApiSchema)

  await testEntityRoutes(gatewayOrigin, ['/api1/users'])

  {
    const { statusCode } = await gateway.inject({
      method: 'GET',
      url: '/api2/posts'
    })
    assert.equal(statusCode, 200)
  }
})

test('should allow custom title', async t => {
  const api1 = await createOpenApiApplication(t, ['users'])
  const api2 = await createOpenApiApplication(t, ['posts'])

  await api1.listen({ port: 0 })
  await api2.listen({ port: 0 })

  const gateway = await createFromConfig(t, {
    server: {
      logger: {
        level: 'fatal'
      }
    },
    gateway: {
      applications: [
        {
          id: 'api1',
          origin: 'http://127.0.0.1:' + api1.server.address().port,
          openapi: {
            url: '/documentation/json',
            prefix: '/api1'
          }
        },
        {
          id: 'api2',
          origin: 'http://127.0.0.1:' + api2.server.address().port,
          openapi: {
            url: '/documentation/json',
            prefix: '/api2'
          }
        }
      ],
      openapi: {
        title: 'My API',
        version: '1.0.42'
      }
    }
  })

  await gateway.start({ listen: true })

  const { statusCode, body } = await gateway.inject({
    method: 'GET',
    url: '/documentation/json'
  })
  assert.equal(statusCode, 200)

  const openApiSchema = JSON.parse(body)
  assert.equal(openApiSchema.info.title, 'My API')
  assert.equal(openApiSchema.info.version, '1.0.42')
})

test('should parse array querystring', async t => {
  const api1 = await createOpenApiApplication(t, ['users'])
  await api1.listen({ port: 0 })

  const gateway = await createFromConfig(t, {
    server: {
      logger: {
        level: 'fatal'
      }
    },
    gateway: {
      applications: [
        {
          id: 'api1',
          origin: 'http://127.0.0.1:' + api1.server.address().port,
          openapi: {
            url: '/documentation/json'
          }
        }
      ]
    }
  })

  const gatewayOrigin = await gateway.start({ listen: true })

  const { statusCode } = await request(gatewayOrigin, {
    method: 'GET',
    path: '/users?fields=id,name'
  })
  assert.equal(statusCode, 200)
})

test('should compose empty responses', async t => {
  const api = await createBasicApplication(t)
  await api.listen({ port: 0 })

  const gateway = await createFromConfig(t, {
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
            url: '/documentation/json',
            prefix: '/api'
          }
        }
      ],
      addEmptySchema: true
    }
  })

  await gateway.start({ listen: true })

  const { statusCode, body } = await gateway.inject({
    method: 'GET',
    url: '/documentation/json'
  })
  assert.equal(statusCode, 200)

  const openApiSchema = JSON.parse(body)
  openApiValidator.validate(openApiSchema)

  const emptyRouteResponses = openApiSchema.paths['/api/empty'].get.responses
  assert.ok(emptyRouteResponses['204'])
  assert.ok(emptyRouteResponses['302'])
})

test('should compose applications with authentication components', async t => {
  const api = await createBasicApplication(t, {
    openapi: {
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'Enter the token with the `Bearer` prefix, e.g. "Bearer abcde12345"'
          }
        }
      }
    }
  })

  api.get(
    '/authenticated',
    {
      schema: {
        security: [
          {
            bearerAuth: []
          }
        ],
        response: {
          200: {
            type: 'object',
            properties: {
              hello: { type: 'string' }
            }
          }
        }
      }
    },
    async (request, reply) => {
      return { hello: 'world' }
    }
  )

  await api.listen({ port: 0 })

  const gateway = await createFromConfig(t, {
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
            url: '/documentation/json',
            prefix: '/api'
          }
        }
      ],
      addEmptySchema: true
    }
  })

  await gateway.start({ listen: true })

  const { statusCode, body } = await gateway.inject({
    method: 'GET',
    url: '/documentation/json'
  })
  assert.equal(statusCode, 200)

  const openApiSchema = JSON.parse(body)
  openApiValidator.validate(openApiSchema)

  assert.deepStrictEqual(openApiSchema.components, {
    securitySchemes: {
      api1_bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter the token with the `Bearer` prefix, e.g. "Bearer abcde12345"'
      }
    },
    schemas: {}
  })

  const authenticatedPath = openApiSchema.paths['/api/authenticated']

  assert.deepStrictEqual(authenticatedPath.get, {
    security: [
      {
        api1_bearerAuth: []
      }
    ],
    responses: {
      200: {
        description: 'Default Response',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                hello: {
                  type: 'string'
                }
              }
            }
          }
        }
      }
    }
  })
})

test('should proxy multipart content in OpenAPI composition', async t => {
  const api = await createBasicApplication(t)

  await api.register(import('@fastify/multipart'))

  // Add a multipart endpoint to the test API
  api.post(
    '/upload',
    {
      schema: {
        consumes: ['multipart/form-data'],
        response: {
          200: {
            type: 'object',
            properties: {
              message: { type: 'string' },
              contentType: { type: 'string' },
              parts: { type: 'number' }
            }
          }
        }
      }
    },
    async (request, reply) => {
      const parts = []
      if (request.isMultipart()) {
        for await (const part of request.parts()) {
          parts.push(part)
        }
      }
      return {
        contentType: request.headers['content-type'] || 'unknown',
        parts: parts.length
      }
    }
  )

  await api.listen({ port: 0 })

  const gateway = await createFromConfig(t, {
    server: {
      logger: {
        level: 'fatal'
      }
    },
    gateway: {
      applications: [
        {
          id: 'api',
          origin: 'http://127.0.0.1:' + api.server.address().port,
          openapi: {
            url: '/documentation/json',
            prefix: '/api'
          }
        }
      ]
    }
  })

  const gatewayOrigin = await gateway.start({ listen: true })

  // Test multipart form data upload through the gateway
  const boundary = '----formdata-platformatic-test'
  const multipartBody = [
    `--${boundary}`,
    'Content-Disposition: form-data; name="description"',
    '',
    'Test file description',
    `--${boundary}`,
    'Content-Disposition: form-data; name="file"; filename="test.txt"',
    'Content-Type: text/plain',
    '',
    'test content',
    `--${boundary}--`,
    ''
  ].join('\r\n')

  const { statusCode, body } = await request(gatewayOrigin, {
    method: 'POST',
    path: '/api/upload',
    headers: {
      'content-type': `multipart/form-data; boundary=${boundary}`
    },
    body: multipartBody
  })

  // This test should initially fail due to multipart content not being properly proxied
  assert.equal(statusCode, 200)
  const response = JSON.parse(await body.text())
  assert.equal(response.parts, 2)
  assert.ok(response.contentType.includes('multipart/form-data'))
})

test('should proxy binary content in OpenAPI composition', async t => {
  const api = await createBasicApplication(t)

  api.addContentTypeParser('application/octet-stream', { parseAs: 'buffer' }, function (req, body, done) {
    done(null, body)
  })

  // Add a binary endpoint to the test API
  api.post(
    '/binary',
    {
      schema: {
        response: {
          200: {
            type: 'object',
            properties: {
              message: { type: 'string' },
              contentType: { type: 'string' },
              bodyLength: { type: 'number' }
            }
          }
        }
      }
    },
    async (request, reply) => {
      return {
        message: 'Binary content received',
        contentType: request.headers['content-type'] || 'unknown',
        bodyLength: request.body ? request.body.length : 0
      }
    }
  )

  await api.listen({ port: 0 })

  const gateway = await createFromConfig(t, {
    server: {
      logger: {
        level: 'fatal'
      }
    },
    gateway: {
      applications: [
        {
          id: 'api',
          origin: 'http://127.0.0.1:' + api.server.address().port,
          openapi: {
            url: '/documentation/json',
            prefix: '/api'
          }
        }
      ]
    }
  })

  const gatewayOrigin = await gateway.start({ listen: true })

  // Test binary content upload through the gateway
  const binaryData = Buffer.from('test binary content', 'utf8')

  const { statusCode, body } = await request(gatewayOrigin, {
    method: 'POST',
    path: '/api/binary',
    headers: {
      'content-type': 'application/octet-stream'
    },
    body: binaryData
  })

  assert.equal(statusCode, 200)
  const response = JSON.parse(await body.text())
  assert.equal(response.message, 'Binary content received')
  assert.equal(response.contentType, 'application/octet-stream')
  assert.equal(response.bodyLength, binaryData.length)
})

test('should proxy custom content types via config in OpenAPI composition', async t => {
  const api = await createBasicApplication(t)

  // Add content type parser for custom content type
  api.addContentTypeParser('application/custom-type', { parseAs: 'buffer' }, function (req, body, done) {
    done(null, body)
  })

  // Add a custom content type endpoint to the test API
  api.post(
    '/custom',
    {
      schema: {
        response: {
          200: {
            type: 'object',
            properties: {
              message: { type: 'string' },
              contentType: { type: 'string' },
              bodyLength: { type: 'number' }
            }
          }
        }
      }
    },
    async (request, reply) => {
      return {
        message: 'Custom content type received',
        contentType: request.headers['content-type'] || 'unknown',
        bodyLength: request.body ? request.body.length : 0
      }
    }
  )

  await api.listen({ port: 0 })

  const gateway = await createFromConfig(t, {
    server: {
      logger: {
        level: 'fatal'
      }
    },
    gateway: {
      passthroughContentTypes: ['application/custom-type', 'multipart/form-data'],
      applications: [
        {
          id: 'api',
          origin: 'http://127.0.0.1:' + api.server.address().port,
          openapi: {
            url: '/documentation/json',
            prefix: '/api'
          }
        }
      ]
    }
  })

  const gatewayOrigin = await gateway.start({ listen: true })

  // Test custom content type through the gateway
  const customData = Buffer.from('custom content data', 'utf8')

  const { statusCode, body } = await request(gatewayOrigin, {
    method: 'POST',
    path: '/api/custom',
    headers: {
      'content-type': 'application/custom-type'
    },
    body: customData
  })

  assert.equal(statusCode, 200)
  const response = JSON.parse(await body.text())
  assert.equal(response.message, 'Custom content type received')
  assert.equal(response.contentType, 'application/custom-type')
  assert.equal(response.bodyLength, customData.length)
})
