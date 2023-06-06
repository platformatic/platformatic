'use strict'

const { test } = require('tap')
const { request } = require('undici')
const { default: OpenAPISchemaValidator } = require('openapi-schema-validator')
const {
  createComposer,
  createOpenApiService,
  testEntityRoutes
} = require('./helper')

const openApiValidator = new OpenAPISchemaValidator({ version: 3 })

test('should proxy openapi requests', async (t) => {
  const service1 = await createOpenApiService(t, ['users'])
  const service2 = await createOpenApiService(t, ['posts'])

  const origin1 = await service1.listen({ port: 0 })
  const origin2 = await service2.listen({ port: 0 })

  const config = {
    composer: {
      services: [
        {
          id: 'service1',
          origin: origin1,
          openapi: {
            url: '/documentation/json'
          }
        },
        {
          id: 'service2',
          origin: origin2,
          openapi: {
            url: '/documentation/json'
          }
        }
      ],
      proxy: {
        prefix: '/internal'
      },
      refreshTimeout: 1000
    }
  }

  const composer = await createComposer(t, config)
  const composerOrigin = await composer.start()

  const { statusCode, body } = await request(composerOrigin, {
    method: 'GET',
    path: '/documentation/json'
  })
  t.equal(statusCode, 200)

  const openApiSchema = await body.json()
  openApiValidator.validate(openApiSchema)

  for (const path in openApiSchema.paths) {
    if (path.startsWith(config.composer.proxy.prefix)) {
      t.fail('proxy routes should be removed from openapi schema')
    }
  }

  {
    const { statusCode, body } = await request(composerOrigin, {
      method: 'GET',
      path: '/internal/service1/documentation/json'
    })
    t.equal(statusCode, 200)

    const openApiSchema = await body.json()
    openApiValidator.validate(openApiSchema)

    await testEntityRoutes(t, composerOrigin, ['/users'])
    await testEntityRoutes(t, composerOrigin, ['/internal/service1/users'])
  }

  {
    const { statusCode, body } = await request(composerOrigin, {
      method: 'GET',
      path: '/internal/service2/documentation/json'
    })
    t.equal(statusCode, 200)

    const openApiSchema = await body.json()
    openApiValidator.validate(openApiSchema)

    await testEntityRoutes(t, composerOrigin, ['/posts'])
    await testEntityRoutes(t, composerOrigin, ['/internal/service2/posts'])
  }
})
