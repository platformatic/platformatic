'use strict'

const { test } = require('tap')
const { default: OpenAPISchemaValidator } = require('openapi-schema-validator')
const {
  createComposer,
  createOpenApiService
} = require('../helper')

const openApiValidator = new OpenAPISchemaValidator({ version: 3 })

test('should ignore static routes', async (t) => {
  const api = await createOpenApiService(t, ['users'])
  await api.listen({ port: 0 })

  const composer = await createComposer(t,
    {
      composer: {
        services: [
          {
            id: 'api1',
            origin: 'http://127.0.0.1:' + api.server.address().port,
            openapi: {
              url: '/documentation/json',
              ignore: ['/users']
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

  t.ok(openApiSchema.paths['/users'] === undefined)
  t.ok(openApiSchema.paths['/users/{id}'])

  {
    const { statusCode } = await composer.inject({ method: 'GET', url: '/users' })
    t.equal(statusCode, 404)
  }
  {
    const { statusCode } = await composer.inject({ method: 'GET', url: '/users/1' })
    t.equal(statusCode, 200)
  }
})

test('should ignore parametric routes', async (t) => {
  const api = await createOpenApiService(t, ['users'])
  await api.listen({ port: 0 })

  const composer = await createComposer(t,
    {
      composer: {
        services: [
          {
            id: 'api1',
            origin: 'http://127.0.0.1:' + api.server.address().port,
            openapi: {
              url: '/documentation/json',
              ignore: ['/users/{id}']
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

  t.ok(openApiSchema.paths['/users'])
  t.ok(openApiSchema.paths['/users/{id}'] === undefined)

  {
    const { statusCode } = await composer.inject({ method: 'GET', url: '/users' })
    t.equal(statusCode, 200)
  }
  {
    const { statusCode } = await composer.inject({ method: 'GET', url: '/users/1' })
    t.equal(statusCode, 404)
  }
})

test('should ignore routes for only for one service', async (t) => {
  const api1 = await createOpenApiService(t, ['users'])
  await api1.listen({ port: 0 })

  const api2 = await createOpenApiService(t, ['users'])
  await api2.listen({ port: 0 })

  const composer = await createComposer(t,
    {
      composer: {
        services: [
          {
            id: 'api1',
            origin: 'http://127.0.0.1:' + api1.server.address().port,
            openapi: {
              url: '/documentation/json',
              ignore: ['/users']
            }
          },
          {
            id: 'api2',
            origin: 'http://127.0.0.1:' + api2.server.address().port,
            openapi: {
              url: '/documentation/json',
              ignore: ['/users/{id}']
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

  t.ok(openApiSchema.paths['/users'])
  t.ok(openApiSchema.paths['/users/{id}'])

  {
    const { statusCode } = await composer.inject({ method: 'GET', url: '/users' })
    t.equal(statusCode, 200)
  }
  {
    const { statusCode } = await composer.inject({ method: 'GET', url: '/users/1' })
    t.equal(statusCode, 200)
  }
})

test('should ignore only specified methods', async (t) => {
  const api = await createOpenApiService(t, ['users'])
  await api.listen({ port: 0 })

  const composer = await createComposer(t,
    {
      composer: {
        services: [
          {
            id: 'api1',
            origin: 'http://127.0.0.1:' + api.server.address().port,
            openapi: {
              url: '/documentation/json',
              ignore: [
                {
                  path: '/users',
                  methods: ['POST']
                },
                {
                  path: '/users/{id}',
                  methods: ['GET', 'DELETE']
                }
              ]
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

  t.ok(openApiSchema.paths['/users'].get)
  t.ok(openApiSchema.paths['/users'].put)
  t.ok(openApiSchema.paths['/users'].post === undefined)

  t.ok(openApiSchema.paths['/users/{id}'].post)
  t.ok(openApiSchema.paths['/users/{id}'].put)
  t.ok(openApiSchema.paths['/users/{id}'].get === undefined)
  t.ok(openApiSchema.paths['/users/{id}'].delete === undefined)
})

test('should ignore all routes if methods array is not specified', async (t) => {
  const api = await createOpenApiService(t, ['users'])
  await api.listen({ port: 0 })

  const composer = await createComposer(t,
    {
      composer: {
        services: [
          {
            id: 'api1',
            origin: 'http://127.0.0.1:' + api.server.address().port,
            openapi: {
              url: '/documentation/json',
              ignore: [{ path: '/users' }]
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

  t.ok(openApiSchema.paths['/users'] === undefined)
  t.ok(openApiSchema.paths['/users/{id}'])

  {
    const { statusCode } = await composer.inject({ method: 'GET', url: '/users' })
    t.equal(statusCode, 404)
  }
  {
    const { statusCode } = await composer.inject({ method: 'GET', url: '/users/1' })
    t.equal(statusCode, 200)
  }
})

test('should skip route if all routes are ignored', async (t) => {
  const api = await createOpenApiService(t, ['users'])
  await api.listen({ port: 0 })

  const composer = await createComposer(t,
    {
      composer: {
        services: [
          {
            id: 'api1',
            origin: 'http://127.0.0.1:' + api.server.address().port,
            openapi: {
              url: '/documentation/json',
              ignore: [
                {
                  path: '/users',
                  methods: ['GET', 'POST', 'PUT']
                }
              ]
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

  t.ok(openApiSchema.paths['/users'] === undefined)
  t.ok(openApiSchema.paths['/users/{id}'])

  {
    const { statusCode } = await composer.inject({ method: 'GET', url: '/users' })
    t.equal(statusCode, 404)
  }
  {
    const { statusCode } = await composer.inject({ method: 'GET', url: '/users/1' })
    t.equal(statusCode, 200)
  }
})
