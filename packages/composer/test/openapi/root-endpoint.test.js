'use strict'

const { test } = require('tap')

const {
  createComposer,
  createOpenApiService
} = require('../helper')

test('should respond 200 on root endpoint', async (t) => {
  const composer = await createComposer(t)

  {
    // No browser (i.e. curl)
    const { statusCode, body } = await composer.inject({ method: 'GET', url: '/' })
    t.equal(statusCode, 200)
    t.same(JSON.parse(body), { message: 'Welcome to Platformatic! Please visit https://oss.platformatic.dev' })
  }

  {
    // browser
    const { statusCode, body } = await composer.inject({
      method: 'GET',
      url: '/',
      headers: { 'user-agent': '' }
    })
    t.equal(statusCode, 200)
    t.same(JSON.parse(body), { message: 'Welcome to Platformatic! Please visit https://oss.platformatic.dev' })
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
    t.equal(statusCode, 200)
    t.equal(headers['content-type'], 'text/html; charset=UTF-8')
    // has links to OpenAPI/GraphQL docs
    t.match(body, '<a id="openapi-link" target="_blank" class="button-link">OpenAPI Documentation</a>')
  }
})

test('should not expose a default root endpoint if it is composed', async (t) => {
  const api = await createOpenApiService(t)

  api.get('/', async (req, reply) => {
    reply.send({ message: 'Hello World!' })
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
  t.equal(statusCode, 200)
  t.same(JSON.parse(body), { message: 'Hello World!' })
})
