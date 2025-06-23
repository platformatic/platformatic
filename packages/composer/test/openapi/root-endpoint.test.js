'use strict'

const assert = require('node:assert/strict')
const { request } = require('undici')
const { readFile } = require('node:fs/promises')
const { test } = require('node:test')
const { createStackableFromConfig, createOpenApiService, createGraphqlService } = require('../helper')

test('should respond 200 on root endpoint', async t => {
  const composer = await createStackableFromConfig(t, {
    server: {
      logger: {
        level: 'fatal'
      }
    }
  })

  {
    // No browser (i.e. curl)
    const { statusCode, body } = await composer.inject({ method: 'GET', url: '/' })
    assert.equal(statusCode, 200)
    assert.deepEqual(JSON.parse(body), {
      message: 'Welcome to Platformatic! Please visit https://docs.platformatic.dev'
    })
  }

  {
    // browser
    const { statusCode, body } = await composer.inject({
      method: 'GET',
      url: '/',
      headers: { 'user-agent': '' }
    })
    assert.equal(statusCode, 200)
    assert.deepEqual(JSON.parse(body), {
      message: 'Welcome to Platformatic! Please visit https://docs.platformatic.dev'
    })
  }

  {
    // browser
    const { statusCode, headers, body } = await composer.inject({
      method: 'GET',
      url: '/',
      headers: {
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/105.0.0.0 Safari/537.36'
      }
    })
    assert.equal(statusCode, 200)
    assert.equal(headers['content-type']?.toLowerCase(), 'text/html; charset=UTF-8'.toLowerCase())
    // Does not have links to OpenAPI/GraphQL docs as it has no services
    assert.ok(!body.includes('<a id="openapi-link" target="_blank" class="button-link">OpenAPI Documentation</a>'))
  }
})

test('should not expose a default root endpoint if it is composed', async t => {
  const api = await createOpenApiService(t)

  api.get('/', async (req, reply) => {
    return { message: 'Hello World!' }
  })

  await api.listen({ port: 0 })

  const composer = await createStackableFromConfig(t, {
    server: {
      logger: {
        level: 'fatal'
      }
    },
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

test('should not expose a default root endpoint if there is a plugin exposing @fastify/static', async t => {
  const composer = await createStackableFromConfig(t, {
    server: {
      logger: {
        level: 'fatal'
      }
    },
    plugins: {
      paths: [
        {
          path: require.resolve('./fixtures/root-static.js')
        }
      ]
    }
  })

  const { statusCode, body } = await composer.inject({ method: 'GET', url: '/' })
  const expected = await readFile(require.resolve('./fixtures/hello/index.html'), 'utf8')
  assert.equal(statusCode, 200)
  assert.deepEqual(body, expected)
})

test('should have links to composed services', async t => {
  const service1 = await createOpenApiService(t, ['users'], { addHeadersSchema: true })
  const service2 = await createOpenApiService(t, ['posts'])
  const service3 = await createOpenApiService(t, ['comments'])
  const service4 = await createGraphqlService(t, {
    schema: `
    type Query {
      mul(x: Int, y: Int): Int
    }`,
    resolvers: {
      Query: {
        async mul (_, { x, y }) {
          return x * y
        }
      }
    }
  })

  const origin1 = await service1.listen({ port: 0 })
  const origin2 = await service2.listen({ port: 0 })
  const origin3 = await service3.listen({ port: 0 })
  const origin4 = await service4.listen({ port: 0 })

  const config = {
    server: {
      logger: {
        level: 'fatal'
      }
    },
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
        },
        {
          id: 'service4',
          origin: origin4,
          graphql: true
        }
      ],
      refreshTimeout: 1000
    }
  }

  const composer = await createStackableFromConfig(t, config)
  const composerOrigin = await composer.start({ listen: true })
  const url = `${composerOrigin}`
  const { body } = await request(url, {
    headers: {
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/105.0.0.0 Safari/537.36'
    }
  })

  const content = await body.text()

  // Has links to OpenAPI/GraphQL docs
  assert.ok(content.includes('<a id="openapi-link" target="_blank" class="button-link" href="documentation">'))
  assert.ok(content.includes('<a id="graphql-link" target="_blank" class="button-link" href="graphiql">'))

  assert.ok(content.includes('<div class="service-path">/internal/service1</div>'))
  assert.ok(content.includes('<div class="service-path">/internal/service2</div>'))
  assert.ok(content.includes('<div class="service-path">/internal/service3</div>'))

  assert.ok(
    content.includes("document.getElementById('proxy-service1-external-link').href = href + '/internal/service1/'")
  )
  assert.ok(
    content.includes("document.getElementById('proxy-service2-external-link').href = href + '/internal/service2/'")
  )
  assert.ok(
    content.includes("document.getElementById('proxy-service3-external-link').href = href + '/internal/service3/'")
  )

  assert.ok(content.includes('<div class="service-path">/service1</div>'))
  assert.ok(content.includes('<div class="service-path">/service2</div>'))
  assert.ok(content.includes('<div class="service-path">/service3</div>'))

  assert.ok(content.includes("const href = window.location.href.replace(/\\/$/, '')"))
})
