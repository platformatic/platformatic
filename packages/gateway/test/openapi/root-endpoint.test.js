import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { request } from 'undici'
import { createFromConfig, createOpenApiApplication } from '../helper.js'

test('should respond 200 on root endpoint', async t => {
  const gateway = await createFromConfig(t, {
    server: {
      logger: {
        level: 'fatal'
      }
    }
  })

  {
    // No browser (i.e. curl)
    const { statusCode, body } = await gateway.inject({ method: 'GET', url: '/' })
    assert.equal(statusCode, 200)
    assert.deepEqual(JSON.parse(body), {
      message: 'Welcome to Platformatic! Please visit https://docs.platformatic.dev'
    })
  }

  {
    // browser
    const { statusCode, body } = await gateway.inject({
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
    const { statusCode, headers, body } = await gateway.inject({
      method: 'GET',
      url: '/',
      headers: {
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/105.0.0.0 Safari/537.36'
      }
    })
    assert.equal(statusCode, 200)
    assert.equal(headers['content-type']?.toLowerCase(), 'text/html; charset=UTF-8'.toLowerCase())
    // Does not have an OpenAPI docs link as it has no applications.
    assert.ok(!body.includes('<a id="openapi-link" target="_blank" class="button-link">OpenAPI Documentation</a>'))
  }
})

test('should not expose a default root endpoint if it is composed', async t => {
  const api = await createOpenApiApplication(t)

  api.get('/', async (req, reply) => {
    return { message: 'Hello World!' }
  })

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
        },
      ]
    }
  })

  const { statusCode, body } = await gateway.inject({ method: 'GET', url: '/' })
  assert.equal(statusCode, 200)
  assert.deepEqual(JSON.parse(body), { message: 'Hello World!' })
})

test('should not expose a default root endpoint if there is a plugin exposing @fastify/static', async t => {
  const gateway = await createFromConfig(t, {
    server: {
      logger: {
        level: 'fatal'
      }
    },
    plugins: {
      paths: [
        {
          path: resolve(import.meta.dirname, './fixtures/root-static.js')
        }
      ]
    }
  })

  const { statusCode, body } = await gateway.inject({ method: 'GET', url: '/' })
  const expected = await readFile(resolve(import.meta.dirname, './fixtures/hello/index.html'), 'utf8')
  assert.equal(statusCode, 200)
  assert.deepEqual(body, expected)
})

test('should have links to composed applications', async t => {
  const application1 = await createOpenApiApplication(t, ['users'], { addHeadersSchema: true })
  const application2 = await createOpenApiApplication(t, ['posts'])
  const application3 = await createOpenApiApplication(t, ['comments'])
  const origin1 = await application1.listen({ port: 0 })
  const origin2 = await application2.listen({ port: 0 })
  const origin3 = await application3.listen({ port: 0 })

  const config = {
    server: {
      logger: {
        level: 'fatal'
      }
    },
    gateway: {
      applications: [
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
      ],
      refreshTimeout: 1000
    }
  }

  const gateway = await createFromConfig(t, config)
  const gatewayOrigin = await gateway.start({ listen: true })
  const url = `${gatewayOrigin}`
  const { body } = await request(url, {
    headers: {
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/105.0.0.0 Safari/537.36'
    }
  })

  const content = await body.text()

  // Has a link to the OpenAPI docs.
  assert.ok(content.includes('<a id="openapi-link" target="_blank" class="button-link" href="documentation">'))

  assert.ok(content.includes('<div class="service-path">/internal/service1</div>'))
  assert.ok(content.includes('<div class="service-path">/internal/service2</div>'))
  assert.ok(content.includes('<div class="service-path">/internal/service3</div>'))

  assert.ok(
    content.includes("document.getElementById('proxy-service1-external-link').href = baseUrl + '/internal/service1/'")
  )
  assert.ok(
    content.includes("document.getElementById('proxy-service2-external-link').href = baseUrl + '/internal/service2/'")
  )
  assert.ok(
    content.includes("document.getElementById('proxy-service3-external-link').href = baseUrl + '/internal/service3/'")
  )

  assert.ok(content.includes('<div class="service-path">/service1</div>'))
  assert.ok(content.includes('<div class="service-path">/service2</div>'))
  assert.ok(content.includes('<div class="service-path">/service3</div>'))

  // Links are built from origin + pathname, never from window.location.href:
  // href carries the query string, so concatenating a service path onto it
  // folds that path into the query (at "/?dpl=v1" the old code produced
  // "/?dpl=v1/internal/service1/"). See packages/gateway/public/index.njk.
  assert.ok(content.includes("const basePath = window.location.pathname.replace(/\\/$/, '')"))
  assert.ok(content.includes('const baseUrl = window.location.origin + basePath'))
  // The buggy form specifically: href includes the query string.
  assert.ok(!content.includes('const href = window.location.href'))
})

test('should honour openapi.swaggerPrefix in the root page and spec routes', async t => {
  /* https://github.com/platformatic/platformatic/issues/1924 */
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
      ],
      openapi: {
        swaggerPrefix: '/custom-docs'
      }
    }
  })

  {
    // The root page links to the configured prefix
    const { statusCode, body } = await gateway.inject({
      method: 'GET',
      url: '/',
      headers: {
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/105.0.0.0 Safari/537.36'
      }
    })
    assert.equal(statusCode, 200)
    assert.ok(body.includes('href="custom-docs"'))
    assert.ok(!body.includes('href="documentation"'))
  }

  {
    // The spec routes follow the configured prefix
    const { statusCode, body } = await gateway.inject({ method: 'GET', url: '/custom-docs/json' })
    assert.equal(statusCode, 200)
    assert.ok(JSON.parse(body).openapi)
  }

  {
    const { statusCode } = await gateway.inject({ method: 'GET', url: '/custom-docs/yaml' })
    assert.equal(statusCode, 200)
  }
})
