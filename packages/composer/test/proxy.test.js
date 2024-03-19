'use strict'

const assert = require('assert/strict')
const { test } = require('node:test')
const { request } = require('undici')
const { default: OpenAPISchemaValidator } = require('openapi-schema-validator')
const {
  createComposer,
  createOpenApiService,
  testEntityRoutes
} = require('./helper')

const openApiValidator = new OpenAPISchemaValidator({ version: 3 })

test('should proxy openapi requests', async (t) => {
  const service1 = await createOpenApiService(t, ['users'], { addHeadersSchema: true })
  const service2 = await createOpenApiService(t, ['posts'])
  const service3 = await createOpenApiService(t, ['comments'])

  const origin1 = await service1.listen({ port: 0 })
  const origin2 = await service2.listen({ port: 0 })
  const origin3 = await service3.listen({ port: 0 })

  const config = {
    composer: {
      services: [
        {
          id: 'service1',
          origin: origin1,
          openapi: {
            url: '/documentation/json'
          },
          proxy: {
            prefix: '/internal/service1'
          }
        },
        {
          id: 'service2',
          origin: origin2,
          openapi: {
            url: '/documentation/json'
          },
          proxy: {
            prefix: '/internal/service2'
          }
        },
        {
          id: 'service3',
          origin: origin3,
          openapi: {
            url: '/documentation/json'
          },
          proxy: {
            prefix: '/'
          }
        }
      ],
      refreshTimeout: 1000
    }
  }

  const composer = await createComposer(t, config)
  const composerOrigin = await composer.start()

  const { statusCode, body } = await request(composerOrigin, {
    method: 'GET',
    path: '/documentation/json'
  })
  assert.equal(statusCode, 200)

  const openApiSchema = await body.json()
  openApiValidator.validate(openApiSchema)

  for (const path in openApiSchema.paths) {
    for (const service of config.composer.services) {
      const proxyPrefix = service.proxy.prefix.at(-1) === '/'
        ? service.proxy.prefix.slice(0, -1)
        : service.proxy.prefix

      if (
        path === proxyPrefix + '/' ||
        path === proxyPrefix + '/*'
      ) {
        assert.fail('proxy routes should be removed from openapi schema')
      }
    }
  }

  {
    const { statusCode, body } = await request(composerOrigin, {
      method: 'GET',
      path: '/internal/service1/documentation/json'
    })
    assert.equal(statusCode, 200)

    const openApiSchema = await body.json()
    openApiValidator.validate(openApiSchema)

    await testEntityRoutes(composerOrigin, ['/users'])
    await testEntityRoutes(composerOrigin, ['/internal/service1/users'])
  }

  {
    const { statusCode, body } = await request(composerOrigin, {
      method: 'GET',
      path: '/internal/service2/documentation/json'
    })
    assert.equal(statusCode, 200)

    const openApiSchema = await body.json()
    openApiValidator.validate(openApiSchema)

    await testEntityRoutes(composerOrigin, ['/posts'])
    await testEntityRoutes(composerOrigin, ['/internal/service2/posts'])
  }

  {
    // internal service gets the x-forwarded-for and x-forwarded-host headers
    const { statusCode, body } = await request(composerOrigin, {
      method: 'GET',
      path: '/internal/service1/headers'
    })
    assert.equal(statusCode, 200)

    const returnedHeaders = await body.json()

    const expectedForwardedHost = composerOrigin.replace('http://', '')
    const [expectedForwardedFor] = expectedForwardedHost.split(':')
    assert.equal(returnedHeaders['x-forwarded-host'], expectedForwardedHost)
    assert.equal(returnedHeaders['x-forwarded-for'], expectedForwardedFor)
  }
})
