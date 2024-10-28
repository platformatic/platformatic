'use strict'

const assert = require('node:assert/strict')
const { request } = require('undici')
const { readFile } = require('node:fs/promises')
const { test } = require('node:test')
const {
  createComposer,
  createOpenApiService,
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
      headers: { 'user-agent': '' },
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
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/105.0.0.0 Safari/537.36',
      },
    })
    assert.equal(statusCode, 200)
    assert.equal(headers['content-type'], 'text/html; charset=UTF-8')
    console.log(body)
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
            url: '/documentation/json',
          },
        },
      ],
    },
  })

  const { statusCode, body } = await composer.inject({ method: 'GET', url: '/' })
  assert.equal(statusCode, 200)
  assert.deepEqual(JSON.parse(body), { message: 'Hello World!' })
})

test('should not expose a default root endpoint if there is a plugin exposing @fastify/static', async (t) => {
  const composer = await createComposer(t, {
    plugins: {
      paths: [{
        path: require.resolve('./fixtures/root-static.js'),
      }]
    },
  })

  const { statusCode, body } = await composer.inject({ method: 'GET', url: '/' })
  const expected = await readFile(require.resolve('./fixtures/hello/index.html'), 'utf8')
  assert.equal(statusCode, 200)
  assert.deepEqual(body, expected)
})

test.skip('should have links to composed services', async (t) => {
  const service1 = await createOpenApiService(t, ['users'], { addHeadersSchema: true })
  const service2 = await createOpenApiService(t, ['posts'])
  const service3 = await createOpenApiService(t, ['comments'])

  const origin1 = await service1.listen({ port: 0 })
  const origin2 = await service2.listen({ port: 0 })
  const origin3 = await service3.listen({ port: 0 })

  const config = {
    composer: {
      services: [
        {
          id: 'service1',
          origin: origin1,
          openapi: {
            url: '/documentation/json'
          },
          proxy: {
            prefix: '/internal/service1'
          }
        },
        {
          id: 'service2',
          origin: origin2,
          openapi: {
            url: '/documentation/json'
          },
          proxy: {
            prefix: '/internal/service2'
          }
        },
        {
          id: 'service3',
          origin: origin3,
          openapi: {
            url: '/documentation/json'
          },
          proxy: {
            prefix: '/internal/service3'
          }
        }
      ],
      refreshTimeout: 1000
    }
  }

  const composer = await createComposer(t, config)
  const composerOrigin = await composer.start()
  const url = `${composerOrigin}/internal/service1/users`
  const { statusCode, body } = await request(url)

  console.log(statusCode, await body.json())
})
