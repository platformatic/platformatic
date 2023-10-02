'use strict'

const assert = require('node:assert/strict')
const { test } = require('node:test')
const { join } = require('node:path')
const { request } = require('undici')
const { default: OpenAPISchemaValidator } = require('openapi-schema-validator')
const {
  createComposer,
  createOpenApiService,
  testEntityRoutes
} = require('../helper')

const openApiValidator = new OpenAPISchemaValidator({ version: 3 })

test('should compose openapi with prefixes', async (t) => {
  const api1 = await createOpenApiService(t, ['users'])
  const api2 = await createOpenApiService(t, ['posts'])

  await api1.listen({ port: 0 })
  await api2.listen({ port: 0 })

  const composer = await createComposer(t, {
    composer: {
      services: [
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

  const composerOrigin = await composer.start()

  const { statusCode, body } = await composer.inject({
    method: 'GET',
    url: '/documentation/json'
  })
  assert.equal(statusCode, 200)

  const openApiSchema = JSON.parse(body)
  openApiValidator.validate(openApiSchema)

  await testEntityRoutes(composerOrigin, ['/api1/users', '/api2/posts'])
})

test('should compose openapi without prefixes', async (t) => {
  const api1 = await createOpenApiService(t, ['users'])
  const api2 = await createOpenApiService(t, ['posts'])

  await api1.listen({ port: 0 })
  await api2.listen({ port: 0 })

  const composer = await createComposer(t, {
    composer: {
      services: [
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

  const composerOrigin = await composer.start()

  const { statusCode, body } = await composer.inject({
    method: 'GET',
    url: '/documentation/json'
  })
  assert.equal(statusCode, 200)

  const openApiSchema = JSON.parse(body)
  openApiValidator.validate(openApiSchema)

  await testEntityRoutes(composerOrigin, ['/users', '/posts'])
})

test('should read schemas from disk and compose openapi', async (t) => {
  const api1 = await createOpenApiService(t, ['users'])
  const api2 = await createOpenApiService(t, ['posts'])

  await api1.listen({ port: 0 })
  await api2.listen({ port: 0 })

  const composer = await createComposer(t, {
    composer: {
      services: [
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

  const composerOrigin = await composer.start()

  const { statusCode, body } = await composer.inject({
    method: 'GET',
    url: '/documentation/json'
  })
  assert.equal(statusCode, 200)

  const openApiSchema = JSON.parse(body)
  openApiValidator.validate(openApiSchema)

  await testEntityRoutes(composerOrigin, ['/users', '/posts'])
})

test('should not proxy request if it is not in a schema file', async (t) => {
  const api1 = await createOpenApiService(t, ['users'])
  const api2 = await createOpenApiService(t, ['posts'])

  api1.get('/not-in-the-schema', async () => {
    assert.fail('should not proxy request')
  })

  await api1.listen({ port: 0 })
  await api2.listen({ port: 0 })

  const composer = await createComposer(t, {
    composer: {
      services: [
        {
          id: 'api1',
          origin: 'http://127.0.0.1:' + api1.server.address().port,
          openapi: {
            file: join(__dirname, 'fixtures', 'schemas', 'users.json')
          }
        },
        {
          id: 'api2',
          origin: 'http://127.0.0.1:' + api2.server.address().port,
          openapi: {
            file: join(__dirname, 'fixtures', 'schemas', 'posts.json')
          }
        }
      ]
    }
  })

  const composerOrigin = await composer.start()

  const { statusCode, body } = await composer.inject({
    method: 'GET',
    url: '/documentation/json'
  })
  assert.equal(statusCode, 200)

  const openApiSchema = JSON.parse(body)
  openApiValidator.validate(openApiSchema)

  assert.ok(
    !openApiSchema.paths['/not-in-the-schema'],
    'should not have the path in the schema'
  )

  await testEntityRoutes(composerOrigin, ['/users', '/posts'])

  {
    const { statusCode } = await composer.inject({
      method: 'GET',
      url: '/not-in-the-schema'
    })
    assert.equal(statusCode, 404)
  }
})

test('should not compose api if there is no openapi config', async (t) => {
  const api1 = await createOpenApiService(t, ['users'])
  const api2 = await createOpenApiService(t, ['posts'])

  await api1.listen({ port: 0 })
  await api2.listen({ port: 0 })

  const composer = await createComposer(t, {
    composer: {
      services: [
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

  const composerOrigin = await composer.start()

  const { statusCode, body } = await composer.inject({
    method: 'GET',
    url: '/documentation/json'
  })
  assert.equal(statusCode, 200)

  const openApiSchema = JSON.parse(body)
  openApiValidator.validate(openApiSchema)

  await testEntityRoutes(composerOrigin, ['/api1/users'])

  {
    const { statusCode } = await composer.inject({
      method: 'GET',
      url: '/api2/posts'
    })
    assert.equal(statusCode, 404)
  }
})

test('should allow custom title', async (t) => {
  const api1 = await createOpenApiService(t, ['users'])
  const api2 = await createOpenApiService(t, ['posts'])

  await api1.listen({ port: 0 })
  await api2.listen({ port: 0 })

  const composer = await createComposer(t, {
    composer: {
      services: [
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

  await composer.start()

  const { statusCode, body } = await composer.inject({
    method: 'GET',
    url: '/documentation/json'
  })
  assert.equal(statusCode, 200)

  const openApiSchema = JSON.parse(body)
  assert.equal(openApiSchema.info.title, 'My API')
  assert.equal(openApiSchema.info.version, '1.0.42')
})

test('should parse array querystring', async (t) => {
  const api1 = await createOpenApiService(t, ['users'])
  await api1.listen({ port: 0 })

  const composer = await createComposer(t, {
    composer: {
      services: [
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

  const composerOrigin = await composer.start()

  const { statusCode } = await request(composerOrigin, {
    method: 'GET',
    path: '/users?fields=id,name'
  })
  assert.equal(statusCode, 200)
})
