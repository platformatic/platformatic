import assert from 'node:assert/strict'
import { join } from 'node:path'
import test from 'node:test'
import openAPISchemaValidator from 'openapi-schema-validator'
import { createFromConfig, createOpenApiApplication, testEntityRoutes } from '../helper.js'

const OpenAPISchemaValidator = openAPISchemaValidator.default
const openApiValidator = new OpenAPISchemaValidator({ version: 3 })

test('should add custom gateway route to the composed schema', async t => {
  const api = await createOpenApiApplication(t, ['users'])
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
            url: '/documentation/json'
          }
        }
      ]
    },
    plugins: {
      paths: [join(import.meta.dirname, 'fixtures', 'plugins', 'custom.js')]
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
  assert.ok(openApiSchema.paths['/custom'])

  await testEntityRoutes(gatewayOrigin, ['/users'])

  {
    const { statusCode } = await gateway.inject({ method: 'GET', url: '/custom' })
    assert.equal(statusCode, 200)
  }
})
