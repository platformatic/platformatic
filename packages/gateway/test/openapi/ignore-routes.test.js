import assert from 'node:assert/strict'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import openAPISchemaValidator from 'openapi-schema-validator'
import { createFromConfig, createOpenApiApplication } from '../helper.js'

const OpenAPISchemaValidator = openAPISchemaValidator.default
const openApiValidator = new OpenAPISchemaValidator({ version: 3 })

test('should ignore static routes', async t => {
  const api = await createOpenApiApplication(t, ['users'])
  await api.listen({ port: 0 })

  const openapiConfig = {
    paths: {
      '/users': {
        ignore: true
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

  assert.ok(openApiSchema.paths['/users'] === undefined)
  assert.ok(openApiSchema.paths['/users/{id}'])

  {
    const { statusCode } = await gateway.inject({ method: 'GET', url: '/users' })
    assert.equal(statusCode, 404)
  }
  {
    const { statusCode } = await gateway.inject({ method: 'GET', url: '/users/1' })
    assert.equal(statusCode, 200)
  }
})

test('should ignore parametric routes', async t => {
  const api = await createOpenApiApplication(t, ['users'])
  await api.listen({ port: 0 })

  const openapiConfig = {
    paths: {
      '/users/{id}': {
        ignore: true
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

  assert.ok(openApiSchema.paths['/users'])
  assert.ok(openApiSchema.paths['/users/{id}'] === undefined)

  {
    const { statusCode } = await gateway.inject({ method: 'GET', url: '/users' })
    assert.equal(statusCode, 200)
  }
  {
    const { statusCode } = await gateway.inject({ method: 'GET', url: '/users/1' })
    assert.equal(statusCode, 404)
  }
})

test('should ignore routes for only for one application', async t => {
  const api1 = await createOpenApiApplication(t, ['users'])
  await api1.listen({ port: 0 })

  const api2 = await createOpenApiApplication(t, ['users'])
  await api2.listen({ port: 0 })

  const openapiConfig1 = {
    paths: {
      '/users': {
        ignore: true
      }
    }
  }

  const openapiConfig2 = {
    paths: {
      '/users/{id}': {
        ignore: true
      }
    }
  }

  const cwd = await mkdtemp(join(tmpdir(), 'gateway-'))

  const openapiConfigFile1 = join(cwd, 'openapi-1.json')
  await writeFile(openapiConfigFile1, JSON.stringify(openapiConfig1))

  const openapiConfigFile2 = join(cwd, 'openapi-2.json')
  await writeFile(openapiConfigFile2, JSON.stringify(openapiConfig2))

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
            config: openapiConfigFile1
          }
        },
        {
          id: 'api2',
          origin: 'http://127.0.0.1:' + api2.server.address().port,
          openapi: {
            url: '/documentation/json',
            config: openapiConfigFile2
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

  assert.ok(openApiSchema.paths['/users'])
  assert.ok(openApiSchema.paths['/users/{id}'])

  {
    const { statusCode } = await gateway.inject({ method: 'GET', url: '/users' })
    assert.equal(statusCode, 200)
  }
  {
    const { statusCode } = await gateway.inject({ method: 'GET', url: '/users/1' })
    assert.equal(statusCode, 200)
  }
})

test('should ignore only specified methods', async t => {
  const api = await createOpenApiApplication(t, ['users'])
  await api.listen({ port: 0 })

  const openapiConfig = {
    paths: {
      '/users': {
        post: { ignore: true }
      },
      '/users/{id}': {
        get: { ignore: true },
        delete: { ignore: true }
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

  assert.ok(openApiSchema.paths['/users'].get)
  assert.ok(openApiSchema.paths['/users'].put)
  assert.ok(openApiSchema.paths['/users'].post === undefined)

  assert.ok(openApiSchema.paths['/users/{id}'].post)
  assert.ok(openApiSchema.paths['/users/{id}'].put)
  assert.ok(openApiSchema.paths['/users/{id}'].get === undefined)
  assert.ok(openApiSchema.paths['/users/{id}'].delete === undefined)
})

test('should ignore all routes if methods array is not specified', async t => {
  const api = await createOpenApiApplication(t, ['users'])
  await api.listen({ port: 0 })

  const openapiConfig = {
    paths: {
      '/users': { ignore: true }
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

  assert.ok(openApiSchema.paths['/users'] === undefined)
  assert.ok(openApiSchema.paths['/users/{id}'])

  {
    const { statusCode } = await gateway.inject({ method: 'GET', url: '/users' })
    assert.equal(statusCode, 404)
  }
  {
    const { statusCode } = await gateway.inject({ method: 'GET', url: '/users/1' })
    assert.equal(statusCode, 200)
  }
})

test('should skip route if all routes are ignored', async t => {
  const api = await createOpenApiApplication(t, ['users'])
  await api.listen({ port: 0 })

  const openapiConfig = {
    paths: {
      '/users': {
        get: { ignore: true },
        post: { ignore: true },
        put: { ignore: true }
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

  assert.ok(openApiSchema.paths['/users'] === undefined)
  assert.ok(openApiSchema.paths['/users/{id}'])

  {
    const { statusCode } = await gateway.inject({ method: 'GET', url: '/users' })
    assert.equal(statusCode, 404)
  }
  {
    const { statusCode } = await gateway.inject({ method: 'GET', url: '/users/1' })
    assert.equal(statusCode, 200)
  }
})
