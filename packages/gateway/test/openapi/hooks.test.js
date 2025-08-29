import assert from 'node:assert/strict'
import { join } from 'node:path'
import { test } from 'node:test'
import { request } from 'undici'
import { createBasicApplication, createFromConfig, createOpenApiApplication } from '../helper.js'

test('should add onSend route hook', async t => {
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
      paths: [join(import.meta.dirname, './fixtures/plugins/hook.js')]
    }
  })

  {
    const { statusCode } = await gateway.inject({ method: 'GET', url: '/users/1' })
    assert.equal(statusCode, 304)
  }
})

test('should add multiple onRoute hooks for one route', async t => {
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
      paths: [join(import.meta.dirname, './fixtures/plugins/multiple-hooks.js')]
    }
  })

  {
    const { statusCode, body } = await gateway.inject({ method: 'GET', url: '/users/1' })
    assert.equal(statusCode, 200)

    const routeSchema = JSON.parse(body)
    assert.equal(routeSchema.response[200].description, 'This is a test')
  }
})

test('should parse json response payload', async t => {
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
      paths: [join(import.meta.dirname, './fixtures/plugins/parse-payload.js')]
    }
  })
  const gatewayOrigin = await gateway.start({ listen: true })

  {
    const { statusCode, body } = await request(gatewayOrigin, {
      method: 'GET',
      path: '/users/1'
    })

    assert.equal(statusCode, 200)

    const data = await body.json()
    assert.deepEqual(data, { user_id: 1, first_name: 'test1' })
  }
})

test('should parse text response payload', async t => {
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
            url: '/documentation/json'
          }
        }
      ]
    },
    plugins: {
      paths: [join(import.meta.dirname, './fixtures/plugins/parse-payload.js')]
    }
  })
  const gatewayOrigin = await gateway.start({ listen: true })

  {
    const { statusCode, body } = await request(gatewayOrigin, {
      method: 'GET',
      path: '/text'
    })

    assert.equal(statusCode, 200)

    const data = await body.text()
    assert.deepEqual(data, 'onSend hook: Some text')
  }
})

test('should throw an error if addGatewayOnRouteHook called when app is ready', async t => {
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
    }
  })

  await gateway.start({ listen: true })

  try {
    gateway.getApplication().platformatic.addGatewayOnRouteHook('/users/{id}', ['GET'], () => {})
    assert.fail('should throw an error')
  } catch (err) {
    assert.equal(err.message, 'Fastify instance is already listening. Cannot call "addGatewayOnRouteHook"!')
  }
})

test('should send two different schema objects into different gateway hooks', async t => {
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
            file: join(import.meta.dirname, './fixtures/schemas/users-with-refs.json')
          }
        }
      ]
    },
    plugins: {
      paths: [join(import.meta.dirname, './fixtures/plugins/hooks-with-refs.js')]
    }
  })

  const { statusCode, body } = await gateway.inject({
    method: 'GET',
    url: '/documentation/json'
  })

  assert.equal(statusCode, 200)

  const openApiSchema = JSON.parse(body)

  const usersSchema = openApiSchema.paths['/users'].get.responses[200].content['application/json'].schema
  assert.equal(usersSchema.items.title, 'users_all')

  const userByIdSchema = openApiSchema.paths['/users/{id}'].get.responses[200].content['application/json'].schema
  assert.equal(userByIdSchema.title, 'users_one')
})
