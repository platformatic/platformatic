'use strict'

const assert = require('node:assert/strict')
const { test } = require('node:test')
const { join } = require('node:path')
const { request } = require('undici')
const {
  createComposer,
  createBasicService,
  createOpenApiService,
} = require('../helper')

test('should add onSend route hook', async (t) => {
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
        paths: [join(__dirname, './fixtures/plugins/hook.js')],
      },
    }
  )

  {
    const { statusCode } = await composer.inject({ method: 'GET', url: '/users/1' })
    assert.equal(statusCode, 304)
  }
})

test('should add multiple onRoute hooks for one route', async (t) => {
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
        paths: [join(__dirname, './fixtures/plugins/multiple-hooks.js')],
      },
    }
  )

  {
    const { statusCode, body } = await composer.inject({ method: 'GET', url: '/users/1' })
    assert.equal(statusCode, 200)

    const routeSchema = JSON.parse(body)
    assert.equal(routeSchema.response[200].description, 'This is a test')
  }
})

test('should parse json response payload', async (t) => {
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
        paths: [join(__dirname, './fixtures/plugins/parse-payload.js')],
      },
    }
  )
  const composerOrigin = await composer.start()

  {
    const { statusCode, body } = await request(composerOrigin, {
      method: 'GET',
      path: '/users/1',
    })

    assert.equal(statusCode, 200)

    const data = await body.json()
    assert.deepEqual(data, { user_id: 1, first_name: 'test1' })
  }
})

test('should parse text response payload', async (t) => {
  const api = await createBasicService(t)
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
        paths: [join(__dirname, './fixtures/plugins/parse-payload.js')],
      },
    }
  )
  const composerOrigin = await composer.start()

  {
    const { statusCode, body } = await request(composerOrigin, {
      method: 'GET',
      path: '/text',
    })

    assert.equal(statusCode, 200)

    const data = await body.text()
    assert.deepEqual(data, 'onSend hook: Some text')
  }
})

test('should throw an error if addComposerOnRouteHook called when app is ready', async (t) => {
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
    }
  )

  await composer.ready()

  try {
    composer.platformatic.addComposerOnRouteHook('/users/{id}', ['GET'], () => {})
    assert.fail('should throw an error')
  } catch (err) {
    assert.equal(err.message, 'Fastify instance is already listening. Cannot call "addComposerOnRouteHook"!')
  }
})

test('should send two different schema objects into different composer hooks', async (t) => {
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
              file: join(__dirname, './fixtures/schemas/users-with-refs.json'),
            },
          },
        ],
      },
      plugins: {
        paths: [join(__dirname, './fixtures/plugins/hooks-with-refs.js')],
      },
    }
  )

  await composer.ready()

  const { statusCode, body } = await composer.inject({
    method: 'GET',
    url: '/documentation/json',
  })

  assert.equal(statusCode, 200)

  const openApiSchema = JSON.parse(body)

  const usersSchema = openApiSchema.paths['/users'].get.responses[200].content['application/json'].schema
  assert.equal(usersSchema.items.title, 'users_all')

  const userByIdSchema = openApiSchema.paths['/users/{id}'].get.responses[200].content['application/json'].schema
  assert.equal(userByIdSchema.title, 'users_one')
})
