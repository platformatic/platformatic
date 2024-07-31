'use strict'

const assert = require('node:assert/strict')
const { join } = require('node:path')
const { test } = require('node:test')
const { default: OpenAPISchemaValidator } = require('openapi-schema-validator')
const {
  createComposer,
  createOpenApiService,
  testEntityRoutes,
} = require('../helper')

const openApiValidator = new OpenAPISchemaValidator({ version: 3 })

test('should add custom composer route to the composed schema', async (t) => {
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
            },
          },
        ],
      },
      plugins: {
        paths: [join(__dirname, 'fixtures', 'plugins', 'custom.js')],
      },
    }
  )

  const composerOrigin = await composer.start()

  const { statusCode, body } = await composer.inject({
    method: 'GET',
    url: '/documentation/json',
  })
  assert.equal(statusCode, 200)

  const openApiSchema = JSON.parse(body)
  openApiValidator.validate(openApiSchema)
  assert.ok(openApiSchema.paths['/custom'])

  await testEntityRoutes(composerOrigin, ['/users'])

  {
    const { statusCode } = await composer.inject({ method: 'GET', url: '/custom' })
    assert.equal(statusCode, 200)
  }
})
