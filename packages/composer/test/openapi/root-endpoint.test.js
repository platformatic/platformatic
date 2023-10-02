'use strict'

const assert = require('node:assert/strict')
const { test } = require('node:test')
const {
  createComposer,
  createOpenApiService
} = require('../helper')

test('should respond 200 on root endpoint', async (t) => {
  const composer = await createComposer(t)

  {
    // No browser (i.e. curl)
    const { statusCode, body } = await composer.inject({ method: 'GET', url: '/' })
    assert.equal(statusCode, 200)
    assert.deepEqual(JSON.parse(body), { message: 'Welcome to Platformatic! Please visit https://docs.platformatic.dev' })
  }

  {
    // browser
    const { statusCode, body } = await composer.inject({
      method: 'GET',
      url: '/',
      headers: { 'user-agent': '' }
    })
    assert.equal(statusCode, 200)
    assert.deepEqual(JSON.parse(body), { message: 'Welcome to Platformatic! Please visit https://docs.platformatic.dev' })
  }

  {
    // browser
    const { statusCode, headers, body } = await composer.inject({
      method: 'GET',
      url: '/',
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/105.0.0.0 Safari/537.36'
      }
    })
    assert.equal(statusCode, 200)
    assert.equal(headers['content-type'], 'text/html; charset=UTF-8')
    // has links to OpenAPI/GraphQL docs
    assert.ok(body.includes('<a id="openapi-link" target="_blank" class="button-link">OpenAPI Documentation</a>'))
  }
})

test('should not expose a default root endpoint if it is composed', async (t) => {
  const api = await createOpenApiService(t)

  api.get('/', async (req, reply) => {
    return { message: 'Hello World!' }
  })

  await api.listen({ port: 0 })

  const composer = await createComposer(t, {
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
  })

  const { statusCode, body } = await composer.inject({ method: 'GET', url: '/' })
  assert.equal(statusCode, 200)
  assert.deepEqual(JSON.parse(body), { message: 'Hello World!' })
})
