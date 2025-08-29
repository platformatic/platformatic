import assert from 'node:assert/strict'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import openAPISchemaValidator from 'openapi-schema-validator'
import { createFromConfig, createOpenApiApplication } from '../helper.js'

const OpenAPISchemaValidator = openAPISchemaValidator.default
const openApiValidator = new OpenAPISchemaValidator({ version: 3 })

test('should rename static route', async t => {
  const api = await createOpenApiApplication(t, ['users'])
  await api.listen({ port: 0 })

  const openapiConfig = {
    paths: {
      '/users': {
        alias: '/customers'
      }
    }
  }

  const cwd = await mkdtemp(join(tmpdir(), 'gateway-'))
  const openapiConfigFile = join(cwd, 'openapi.json')
  await writeFile(openapiConfigFile, JSON.stringify(openapiConfig))

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
            config: openapiConfigFile
          }
        }
      ]
    }
  })

  const { statusCode, body } = await gateway.inject({
    method: 'GET',
    url: '/documentation/json'
  })
  assert.equal(statusCode, 200)

  const openApiSchema = JSON.parse(body)
  openApiValidator.validate(openApiSchema)

  assert.ok(openApiSchema.paths['/customers'])
  assert.ok(openApiSchema.paths['/users'] === undefined)

  {
    const { statusCode, body } = await gateway.inject({ method: 'GET', url: '/customers' })
    assert.equal(statusCode, 200)

    const payload = JSON.parse(body)
    assert.deepEqual(payload, [
      { id: 1, name: 'test1' },
      { id: 2, name: 'test2' },
      { id: 3, name: 'test3' },
      { id: 4, name: 'test4' }
    ])
  }
})

test('should rename parametric route', async t => {
  const api = await createOpenApiApplication(t, ['users'])
  await api.listen({ port: 0 })

  const openapiConfig = {
    paths: {
      '/users/{id}': {
        alias: '/customers/{id}'
      }
    }
  }

  const cwd = await mkdtemp(join(tmpdir(), 'gateway-'))
  const openapiConfigFile = join(cwd, 'openapi.json')
  await writeFile(openapiConfigFile, JSON.stringify(openapiConfig))

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
            config: openapiConfigFile
          }
        }
      ]
    }
  })

  const { statusCode, body } = await gateway.inject({
    method: 'GET',
    url: '/documentation/json'
  })
  assert.equal(statusCode, 200)

  const openApiSchema = JSON.parse(body)
  openApiValidator.validate(openApiSchema)

  assert.ok(openApiSchema.paths['/customers/{id}'])
  assert.ok(openApiSchema.paths['/users/{id}'] === undefined)

  {
    const { statusCode, body } = await gateway.inject({ method: 'GET', url: '/customers/1' })
    assert.equal(statusCode, 200)

    const payload = JSON.parse(body)
    assert.deepEqual(payload, { id: 1, name: 'test1' })
  }
})

test('should rename parametric route with prefix', async t => {
  const api = await createOpenApiApplication(t, ['users'])
  await api.listen({ port: 0 })

  const openapiConfig = {
    paths: {
      '/users/{id}': {
        alias: '/customers/{id}'
      }
    }
  }

  const cwd = await mkdtemp(join(tmpdir(), 'gateway-'))
  const openapiConfigFile = join(cwd, 'openapi.json')
  await writeFile(openapiConfigFile, JSON.stringify(openapiConfig))

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
            config: openapiConfigFile,
            prefix: '/prefix1'
          }
        }
      ]
    }
  })

  const { statusCode, body } = await gateway.inject({
    method: 'GET',
    url: '/documentation/json'
  })
  assert.equal(statusCode, 200)

  const openApiSchema = JSON.parse(body)
  openApiValidator.validate(openApiSchema)

  assert.ok(openApiSchema.paths['/prefix1/customers/{id}'])
  assert.ok(openApiSchema.paths['/users/{id}'] === undefined)

  {
    const { statusCode, body } = await gateway.inject({ method: 'GET', url: '/prefix1/customers/1' })
    assert.equal(statusCode, 200)

    const payload = JSON.parse(body)
    assert.deepEqual(payload, { id: 1, name: 'test1' })
  }
})
