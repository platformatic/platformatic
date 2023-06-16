'use strict'

const { join } = require('path')
const { test } = require('tap')
const {
  createComposer,
  createOpenApiService
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
              url: '/documentation/json'
            }
          }
        ]
      },
      plugins: {
        paths: [join(__dirname, './fixtures/plugins/hook.js')]
      }
    }
  )

  {
    const { statusCode } = await composer.inject({ method: 'GET', url: '/users/1' })
    t.equal(statusCode, 304)
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
              url: '/documentation/json'
            }
          }
        ]
      },
      plugins: {
        paths: [join(__dirname, './fixtures/plugins/multiple-hooks.js')]
      }
    }
  )

  {
    const { statusCode, body } = await composer.inject({ method: 'GET', url: '/users/1' })
    t.equal(statusCode, 200)

    const routeSchema = JSON.parse(body)
    t.equal(routeSchema.response[200].description, 'This is a test')
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
              url: '/documentation/json'
            }
          }
        ]
      }
    }
  )

  await composer.ready()

  try {
    composer.addComposerOnRouteHook('/users/{id}', ['GET'], () => {})
    t.fail('should throw an error')
  } catch (err) {
    t.equal(err.message, 'Fastify instance is already listening. Cannot call "addComposerOnRouteHook"!')
  }
})
