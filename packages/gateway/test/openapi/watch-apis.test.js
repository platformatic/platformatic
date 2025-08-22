import assert from 'node:assert/strict'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import openAPISchemaValidator from 'openapi-schema-validator'
import { createGatewayInRuntime, createOpenApiApplication, testEntityRoutes, waitForRestart } from '../helper.js'

const REFRESH_TIMEOUT = 1000

const OpenAPISchemaValidator = openAPISchemaValidator.default
const openApiValidator = new OpenAPISchemaValidator({ version: 3 })

test('should restart gateway if api has been changed', async t => {
  const api1 = await createOpenApiApplication(t, ['users'])
  const api2 = await createOpenApiApplication(t, ['posts'])

  await api1.listen({ port: 0 })
  await api2.listen({ port: 0 })

  const runtime = await createGatewayInRuntime(t, 'openapi-watch', {
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
      refreshTimeout: REFRESH_TIMEOUT
    }
  })

  let gatewayOrigin = await runtime.start()

  {
    const { statusCode, body } = await runtime.inject('gateway', {
      method: 'GET',
      url: '/documentation/json'
    })
    assert.equal(statusCode, 200)

    const openApiSchema = JSON.parse(body)
    openApiValidator.validate(openApiSchema)

    await testEntityRoutes(gatewayOrigin, ['/api1/users', '/api2/posts'])
  }

  await api1.close()

  gatewayOrigin = await waitForRestart(runtime)

  {
    const { statusCode, body } = await runtime.inject('gateway', {
      method: 'GET',
      url: '/documentation/json'
    })
    assert.equal(statusCode, 200)

    const openApiSchema = JSON.parse(body)
    openApiValidator.validate(openApiSchema)

    await testEntityRoutes(gatewayOrigin, ['/api2/posts'])

    const { statusCode: statusCode2 } = await runtime.inject('gateway', {
      method: 'GET',
      url: '/api1/users'
    })
    assert.equal(statusCode2, 404)
  }
})

test('should watch api only if it has a url', async t => {
  const api1 = await createOpenApiApplication(t, ['users'])
  const api2 = await createOpenApiApplication(t, ['posts'])

  await api1.listen({ port: 0 })
  await api2.listen({ port: 0 })

  const runtime = await createGatewayInRuntime(t, 'openapi-watch', {
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
            file: join(import.meta.dirname, 'fixtures', 'schemas', 'posts.json'),
            prefix: '/api2'
          }
        }
      ],
      refreshTimeout: REFRESH_TIMEOUT
    }
  })

  const gatewayOrigin = await runtime.start()

  {
    const { statusCode, body } = await runtime.inject('gateway', {
      method: 'GET',
      url: '/documentation/json'
    })
    assert.equal(statusCode, 200)

    const openApiSchema = JSON.parse(body)
    openApiValidator.validate(openApiSchema)

    await testEntityRoutes(gatewayOrigin, ['/api1/users', '/api2/posts'])
  }

  await api2.close()

  await assert.rejects(() => waitForRestart(runtime, gatewayOrigin))

  {
    const { statusCode, body } = await runtime.inject('gateway', {
      method: 'GET',
      url: '/documentation/json'
    })
    assert.equal(statusCode, 200)

    const openApiSchema = JSON.parse(body)
    openApiValidator.validate(openApiSchema)

    await testEntityRoutes(gatewayOrigin, ['/api1/users'])

    const { statusCode: statusCode2 } = await runtime.inject('gateway', {
      method: 'GET',
      url: '/api2/posts'
    })
    assert.equal(statusCode2, 500)
  }
})

test('should compose schema after application restart', async t => {
  const api1 = await createOpenApiApplication(t, ['users'])
  const api2 = await createOpenApiApplication(t, ['posts'])

  await api1.listen({ port: 0 })
  await api2.listen({ port: 0 })

  const api1Port = api1.server.address().port
  const api2Port = api2.server.address().port

  const runtime = await createGatewayInRuntime(t, 'openapi-watch', {
    server: {
      logger: {
        level: 'fatal'
      }
    },
    gateway: {
      applications: [
        {
          id: 'api1',
          origin: 'http://127.0.0.1:' + api1Port,
          openapi: {
            url: '/documentation/json',
            prefix: '/api1'
          }
        },
        {
          id: 'api2',
          origin: 'http://127.0.0.1:' + api2Port,
          openapi: {
            url: '/documentation/json',
            prefix: '/api2'
          }
        }
      ],
      refreshTimeout: REFRESH_TIMEOUT
    }
  })

  let gatewayOrigin = await runtime.start()

  {
    const { statusCode, body } = await runtime.inject('gateway', {
      method: 'GET',
      url: '/documentation/json'
    })
    assert.equal(statusCode, 200)

    const openApiSchema = JSON.parse(body)
    openApiValidator.validate(openApiSchema)

    await testEntityRoutes(gatewayOrigin, ['/api1/users', '/api2/posts'])
  }

  await api1.close()

  gatewayOrigin = await waitForRestart(runtime, gatewayOrigin)

  {
    const { statusCode, body } = await runtime.inject('gateway', {
      method: 'GET',
      url: '/documentation/json'
    })
    assert.equal(statusCode, 200)

    const openApiSchema = JSON.parse(body)
    openApiValidator.validate(openApiSchema)

    await testEntityRoutes(gatewayOrigin, ['/api2/posts'])

    const { statusCode: statusCode2 } = await runtime.inject('gateway', {
      method: 'GET',
      url: '/api1/users'
    })
    assert.equal(statusCode2, 404)
  }

  const newApi1 = await createOpenApiApplication(t, ['users'])
  await newApi1.listen({ port: api1Port })

  gatewayOrigin = await waitForRestart(runtime, gatewayOrigin)

  {
    const { statusCode, body } = await runtime.inject('gateway', {
      method: 'GET',
      url: '/documentation/json'
    })
    assert.equal(statusCode, 200)

    const openApiSchema = JSON.parse(body)
    openApiValidator.validate(openApiSchema)

    await testEntityRoutes(gatewayOrigin, ['/api1/users', '/api2/posts'])
  }
})

test('should not watch an api if refreshTimeout equals 0', async t => {
  const api1 = await createOpenApiApplication(t, ['users'])
  const api2 = await createOpenApiApplication(t, ['posts'])

  await api1.listen({ port: 0 })
  await api2.listen({ port: 0 })

  const runtime = await createGatewayInRuntime(t, 'openapi-watch', {
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
      refreshTimeout: 0
    }
  })

  await runtime.start()

  await api1.close()
  await api2.close()

  await assert.rejects(() => waitForRestart(runtime))
})

test('should not restart gateway if schema has been changed', async t => {
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

  const runtime = await createGatewayInRuntime(t, 'openapi-watch', {
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
      ],
      refreshTimeout: REFRESH_TIMEOUT
    }
  })

  await runtime.start()

  await assert.rejects(() => waitForRestart(runtime))
})
