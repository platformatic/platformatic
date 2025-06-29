'use strict'

const assert = require('assert/strict')
const selfCert = require('self-cert')
const { tmpdir } = require('node:os')
const { resolve, join } = require('node:path')
const { symlink, mkdtemp, writeFile } = require('node:fs/promises')
const { once, EventEmitter } = require('node:events')
const { test } = require('node:test')
const { request } = require('undici')
const { default: OpenAPISchemaValidator } = require('openapi-schema-validator')
const { Agent, setGlobalDispatcher, getGlobalDispatcher } = require('undici')
const { WebSocket } = require('ws')
const {
  createFromConfig,
  createOpenApiService,
  testEntityRoutes,
  createComposerInRuntime,
  createWebsocketService,
  REFRESH_TIMEOUT
} = require('./helper')
const { buildServer: buildRuntime } = require('../../runtime')
const { safeRemove, createDirectory } = require('@platformatic/utils')

const openApiValidator = new OpenAPISchemaValidator({ version: 3 })

function ensureCleanup (t, folders) {
  function cleanup () {
    return Promise.all(folders.map(safeRemove))
  }

  t.after(cleanup)
  return cleanup()
}

test('should proxy openapi requests', async t => {
  const service1 = await createOpenApiService(t, ['users'], { addHeadersSchema: true })
  const service2 = await createOpenApiService(t, ['posts'])
  const service3 = await createOpenApiService(t, ['comments'])

  const origin1 = await service1.listen({ port: 0 })
  const origin2 = await service2.listen({ port: 0 })
  const origin3 = await service3.listen({ port: 0 })

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
            prefix: '/'
          }
        }
      ],
      refreshTimeout: 1000
    }
  }

  const composer = await createFromConfig(t, config)
  const composerOrigin = await composer.start({ listen: true })

  const { statusCode, body } = await request(composerOrigin, {
    method: 'GET',
    path: '/documentation/json'
  })
  assert.equal(statusCode, 200)

  const openApiSchema = await body.json()
  openApiValidator.validate(openApiSchema)

  for (const path in openApiSchema.paths) {
    for (const service of config.composer.services) {
      const proxyPrefix = service.proxy.prefix.at(-1) === '/' ? service.proxy.prefix.slice(0, -1) : service.proxy.prefix

      if (path === proxyPrefix + '/' || path === proxyPrefix + '/*') {
        assert.fail('proxy routes should be removed from openapi schema')
      }
    }
  }

  {
    const { statusCode, body } = await request(composerOrigin, {
      method: 'GET',
      path: '/internal/service1/documentation/json'
    })
    assert.equal(statusCode, 200)

    const openApiSchema = await body.json()
    openApiValidator.validate(openApiSchema)

    await testEntityRoutes(composerOrigin, ['/users'])
    await testEntityRoutes(composerOrigin, ['/internal/service1/users'])
  }

  {
    const { statusCode, body } = await request(composerOrigin, {
      method: 'GET',
      path: '/internal/service2/documentation/json'
    })
    assert.equal(statusCode, 200)

    const openApiSchema = await body.json()
    openApiValidator.validate(openApiSchema)

    await testEntityRoutes(composerOrigin, ['/posts'])
    await testEntityRoutes(composerOrigin, ['/internal/service2/posts'])
  }

  {
    const { statusCode, body } = await request(composerOrigin, {
      method: 'GET',
      path: '/internal/service1/headers'
    })
    assert.equal(statusCode, 200)

    const returnedHeaders = await body.json()

    const expectedForwardedHost = composerOrigin.replace('http://', '')
    const [expectedForwardedFor] = expectedForwardedHost.split(':')
    assert.equal(returnedHeaders['x-forwarded-host'], expectedForwardedHost)
    assert.equal(returnedHeaders['x-forwarded-for'], expectedForwardedFor)
  }
})

test('should proxy a @platformatic/service to its prefix by default', async t => {
  const runtime = await createComposerInRuntime(
    t,
    'composer-default-prefix',
    {
      composer: {
        services: [
          {
            id: 'main',
            proxy: {}
          }
        ],
        refreshTimeout: REFRESH_TIMEOUT
      }
    },
    [
      {
        id: 'main',
        path: resolve(__dirname, './proxy/fixtures/service')
      }
    ]
  )

  const address = await runtime.start()

  {
    const { statusCode, body: rawBody } = await request(address, {
      method: 'GET',
      path: '/main/hello'
    })
    assert.equal(statusCode, 200)

    const body = await rawBody.json()
    assert.deepStrictEqual(body, { ok: true })
  }

  {
    const { statusCode, body: rawBody } = await request(address, {
      method: 'POST',
      path: '/main/echo',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({ ok: true })
    })
    assert.equal(statusCode, 200)

    const body = await rawBody.json()
    assert.deepStrictEqual(body, { ok: true })
  }
})

test('should proxy a @platformatic/service to the chosen prefix by the user in the configuration', async t => {
  const runtime = await createComposerInRuntime(
    t,
    'composer-prefix-in-conf',
    {
      composer: {
        services: [
          {
            id: 'main',
            proxy: {}
          }
        ],
        refreshTimeout: REFRESH_TIMEOUT
      }
    },
    [
      {
        id: 'main',
        path: resolve(__dirname, './proxy/fixtures/service'),
        config: 'platformatic-prefix-in-conf.json'
      }
    ]
  )

  const address = await runtime.start()

  {
    const { statusCode, body: rawBody } = await request(address, {
      method: 'GET',
      path: '/whatever/hello'
    })
    assert.equal(statusCode, 200)

    const body = await rawBody.json()
    assert.deepStrictEqual(body, { ok: true })
  }
})

test('should proxy a @platformatic/service to the chosen prefix by the user in the code', async t => {
  const runtime = await createComposerInRuntime(
    t,
    'composer-prefix-in-code',
    {
      composer: {
        services: [
          {
            id: 'main',
            proxy: {}
          }
        ],
        refreshTimeout: REFRESH_TIMEOUT
      }
    },
    [
      {
        id: 'main',
        path: resolve(__dirname, './proxy/fixtures/service'),
        config: 'platformatic-prefix-in-code.json'
      }
    ]
  )

  const address = await runtime.start()

  {
    const { statusCode, body: rawBody } = await request(address, {
      method: 'GET',
      path: '/from-code/hello'
    })
    assert.equal(statusCode, 200)

    const body = await rawBody.json()
    assert.deepStrictEqual(body, { ok: true })
  }
})

test('should proxy all services if none are defined', async t => {
  const nodeModulesRoot = resolve(__dirname, './proxy/fixtures/node/node_modules')

  await ensureCleanup(t, [nodeModulesRoot])

  // Make sure there is @platformatic/node available in the node service.
  // We can't simply specify it in the package.json due to circular dependencies.
  await createDirectory(resolve(nodeModulesRoot, '@platformatic'))
  await symlink(resolve(__dirname, '../../node'), resolve(nodeModulesRoot, '@platformatic/node'), 'dir')

  const runtime = await createComposerInRuntime(
    t,
    'composer-prefix-in-code',
    {
      composer: {
        refreshTimeout: REFRESH_TIMEOUT
      }
    },
    [
      {
        id: 'first',
        path: resolve(__dirname, './proxy/fixtures/service'),
        config: 'platformatic.json'
      },
      {
        id: 'second',
        path: resolve(__dirname, './proxy/fixtures/service'),
        config: 'platformatic.json'
      },
      {
        id: 'third',
        path: resolve(__dirname, './proxy/fixtures/node')
      }
    ]
  )

  const address = await runtime.start()

  {
    const { statusCode, body: rawBody } = await request(address, {
      method: 'GET',
      path: '/first/hello'
    })
    assert.equal(statusCode, 200)

    const body = await rawBody.json()
    assert.deepStrictEqual(body, { ok: true })
  }

  {
    const { statusCode, body: rawBody } = await request(address, {
      method: 'GET',
      path: '/second/hello'
    })
    assert.equal(statusCode, 200)

    const body = await rawBody.json()
    assert.deepStrictEqual(body, { ok: true })
  }

  {
    const { statusCode, body: rawBody } = await request(address, {
      method: 'GET',
      path: '/third/hello'
    })
    assert.equal(statusCode, 200)

    const body = await rawBody.json()
    assert.deepStrictEqual(body, { ok: true })
  }
})

test('should fix the path using the referer only if asked to', async t => {
  const nodeModulesRoot = resolve(__dirname, './proxy/fixtures/node/node_modules')
  const astroModulesRoot = resolve(__dirname, './proxy/fixtures/astro/node_modules')

  await ensureCleanup(t, [nodeModulesRoot, astroModulesRoot, resolve(__dirname, './proxy/fixtures/astro/.astro')])

  // Make sure there is @platformatic/node available in the node service.
  // We can't simply specify it in the package.json due to circular dependencies.
  await createDirectory(resolve(nodeModulesRoot, '@platformatic'))
  await symlink(resolve(__dirname, '../../node'), resolve(nodeModulesRoot, '@platformatic/node'), 'dir')

  // Make sure there is @platformatic/astro available in the astro service.
  // We can't simply specify it in the package.json due to circular dependencies.
  await createDirectory(resolve(astroModulesRoot, '@platformatic'))
  await symlink(resolve(__dirname, '../../astro'), resolve(astroModulesRoot, '@platformatic/astro'), 'dir')

  const runtime = await createComposerInRuntime(
    t,
    'referer-redirect',
    {
      composer: {
        refreshTimeout: REFRESH_TIMEOUT
      }
    },
    [
      {
        id: 'first',
        path: resolve(__dirname, './proxy/fixtures/service'),
        config: 'platformatic.json'
      },
      {
        id: 'astro',
        path: resolve(__dirname, './proxy/fixtures/astro'),
        config: 'platformatic.json'
      },
      {
        id: 'third',
        path: resolve(__dirname, './proxy/fixtures/node')
      }
    ]
  )

  const address = await runtime.start()

  {
    const { statusCode, body: rawBody } = await request(address, {
      method: 'GET',
      path: '/first/hello'
    })
    assert.equal(statusCode, 200)

    const body = await rawBody.json()
    assert.deepStrictEqual(body, { ok: true })
  }

  {
    const { statusCode, headers } = await request(address, {
      method: 'GET',
      path: '/third/hello',
      headers: {
        referer: `${address}/astro`
      }
    })
    assert.equal(statusCode, 308)
    assert.equal(headers.location, '/astro/third/hello')
  }

  {
    const { statusCode, body: rawBody } = await request(address, {
      method: 'GET',
      path: '/third/hello',
      headers: {
        referer: `${address}/first`
      }
    })
    assert.equal(statusCode, 200)

    const body = await rawBody.json()
    assert.deepStrictEqual(body, { ok: true })
  }
})

test('should rewrite Location headers for proxied services', async t => {
  const runtime = await createComposerInRuntime(
    t,
    'composer-prefix-in-conf',
    {
      composer: {
        services: [
          {
            id: 'main',
            proxy: {
              prefix: '/whatever'
            }
          }
        ],
        refreshTimeout: REFRESH_TIMEOUT
      }
    },
    [
      {
        id: 'main',
        path: resolve(__dirname, './proxy/fixtures/service'),
        config: 'platformatic.json'
      }
    ]
  )

  const address = await runtime.start()

  {
    const {
      statusCode,
      body: rawBody,
      headers
    } = await request(address, {
      method: 'GET',
      path: '/whatever/redirect'
    })
    assert.equal(statusCode, 302)
    assert.equal(headers.location, '/whatever/hello')

    rawBody.dump()
  }
})

test('should rewrite Location headers that include full url of the running service', async t => {
  const nodeModulesRoot = resolve(__dirname, './proxy/fixtures/node/node_modules')

  await ensureCleanup(t, [nodeModulesRoot])

  // Make sure there is @platformatic/node available in the node service.
  // We can't simply specify it in the package.json due to circular dependencies.
  await createDirectory(resolve(nodeModulesRoot, '@platformatic'))
  await symlink(resolve(__dirname, '../../node'), resolve(nodeModulesRoot, '@platformatic/node'), 'dir')

  const runtime = await createComposerInRuntime(
    t,
    'composer-prefix-in-conf',
    {
      composer: {
        services: [
          {
            id: 'main',
            proxy: {
              prefix: '/whatever'
            }
          }
        ],
        refreshTimeout: REFRESH_TIMEOUT
      }
    },
    [
      {
        id: 'main',
        path: resolve(__dirname, './proxy/fixtures/node')
      }
    ]
  )

  const address = await runtime.start()

  {
    const {
      statusCode,
      body: rawBody,
      headers
    } = await request(address, {
      method: 'GET',
      path: '/whatever/redirect'
    })
    assert.equal(statusCode, 307)
    assert.equal(headers.location, '/whatever/id')

    rawBody.dump()
  }
})

test('should properly configure the frontends on their paths if no composer configuration is present', async t => {
  const nodeModulesRoot = resolve(__dirname, './proxy/fixtures/node/node_modules')
  const astroModulesRoot = resolve(__dirname, './proxy/fixtures/astro/node_modules')
  const nextModulesRoot = resolve(__dirname, './proxy/fixtures/next/node_modules')
  const remixModulesRoot = resolve(__dirname, './proxy/fixtures/remix/node_modules')

  await ensureCleanup(t, [
    nodeModulesRoot,
    astroModulesRoot,
    nextModulesRoot,
    remixModulesRoot,
    resolve(__dirname, './proxy/fixtures/astro/.astro'),
    resolve(__dirname, './proxy/fixtures/next/.next')
  ])

  // Make sure there is @platformatic/node available in the node service.
  // We can't simply specify it in the package.json due to circular dependencies.
  await createDirectory(resolve(nodeModulesRoot, '@platformatic'))
  await symlink(resolve(__dirname, '../../node'), resolve(nodeModulesRoot, '@platformatic/node'), 'dir')

  // Make sure there is @platformatic/astro available in the astro service.
  // We can't simply specify it in the package.json due to circular dependencies.
  await createDirectory(resolve(astroModulesRoot, '@platformatic'))
  await symlink(resolve(__dirname, '../../astro'), resolve(astroModulesRoot, '@platformatic/astro'), 'dir')

  // Make sure there is @platformatic/next available in the next service.
  // We can't simply specify it in the package.json due to circular dependencies.
  await createDirectory(resolve(nextModulesRoot, '@platformatic'))
  await symlink(resolve(__dirname, '../../next'), resolve(nextModulesRoot, '@platformatic/next'), 'dir')

  // Make sure there is @platformatic/next available in the next service.
  // We can't simply specify it in the package.json due to circular dependencies.
  await createDirectory(resolve(remixModulesRoot, '@platformatic'))
  await symlink(resolve(__dirname, '../../remix'), resolve(remixModulesRoot, '@platformatic/remix'), 'dir')

  const runtime = await createComposerInRuntime(
    t,
    'base-path-no-configuration',
    {
      composer: {
        refreshTimeout: REFRESH_TIMEOUT
      }
    },
    [],
    resolve(__dirname, './proxy/fixtures/')
  )

  const address = await runtime.start()

  {
    const { statusCode, body: rawBody } = await request(address, {
      method: 'GET',
      path: '/astro'
    })
    assert.equal(statusCode, 200)

    const body = await rawBody.text()
    assert.ok(body.includes('Hello from Astro'))
  }

  {
    const { statusCode, body: rawBody } = await request(address, {
      method: 'GET',
      path: '/next'
    })
    assert.equal(statusCode, 200)

    const body = await rawBody.text()
    assert.ok(body.includes('Hello from Next'))
  }

  {
    const { statusCode, body: rawBody } = await request(address, {
      method: 'GET',
      path: '/node/id'
    })
    assert.equal(statusCode, 200)

    const body = await rawBody.json()
    assert.deepStrictEqual(body, { from: 'node' })
  }

  {
    const { statusCode, body: rawBody } = await request(address, {
      method: 'GET',
      path: '/service/id'
    })
    assert.equal(statusCode, 200)

    const body = await rawBody.json()
    assert.deepStrictEqual(body, { from: 'service' })
  }
})

test('should properly match services by their hostname', async t => {
  const nodeModulesRoot = resolve(__dirname, './proxy/fixtures/node/node_modules')

  await ensureCleanup(t, [nodeModulesRoot])

  // Make sure there is @platformatic/node available in the node service.
  // We can't simply specify it in the package.json due to circular dependencies.
  await createDirectory(resolve(nodeModulesRoot, '@platformatic'))
  await symlink(resolve(__dirname, '../../node'), resolve(nodeModulesRoot, '@platformatic/node'), 'dir')

  const runtime = await createComposerInRuntime(
    t,
    'base-path-no-configuration',
    {
      composer: {
        refreshTimeout: REFRESH_TIMEOUT,
        services: [
          {
            id: 'service',
            proxy: { hostname: 'service.example.com' }
          },
          {
            id: 'node',
            proxy: { hostname: 'node.example.com' }
          }
        ]
      }
    },
    [
      {
        id: 'node',
        path: resolve(__dirname, './proxy/fixtures/node')
      },
      {
        id: 'service',
        path: resolve(__dirname, './proxy/fixtures/service')
      }
    ]
  )

  const address = await runtime.start()

  // Hostname based access work without prefix
  {
    const { statusCode, body: rawBody } = await request(address, {
      method: 'GET',
      path: '/id',
      headers: {
        host: 'service.example.com'
      }
    })
    assert.equal(statusCode, 200)

    const body = await rawBody.json()
    assert.deepStrictEqual(body, { from: 'service' })
  }

  {
    const { statusCode, body: rawBody } = await request(address, {
      method: 'POST',
      path: '/echo',
      headers: {
        host: 'service.example.com',
        'content-type': 'text/plain'
      },
      body: 'REQUEST'
    })
    assert.equal(statusCode, 200)

    const body = await rawBody.text()
    assert.deepStrictEqual(body, 'REQUEST')
  }

  // Hostname based access does not work with prefix
  {
    const { statusCode } = await request(address, {
      method: 'GET',
      path: '/service/id',
      headers: {
        host: 'service.example.com'
      }
    })
    assert.equal(statusCode, 404)
  }

  {
    const { statusCode } = await request(address, {
      method: 'POST',
      path: '/service/echo',
      headers: {
        host: 'service.example.com',
        'content-type': 'text/plain'
      },
      body: 'REQUEST'
    })
    assert.equal(statusCode, 404)
  }

  // Regular access without hostname and with prefix works
  {
    const { statusCode, body: rawBody } = await request(address, {
      method: 'GET',
      path: '/service/id'
    })
    assert.equal(statusCode, 200)

    const body = await rawBody.json()
    assert.deepStrictEqual(body, { from: 'service' })
  }

  {
    const { statusCode, body: rawBody } = await request(address, {
      method: 'POST',
      path: '/service/echo',
      headers: {
        'content-type': 'text/plain'
      },
      body: 'REQUEST'
    })
    assert.equal(statusCode, 200)

    const body = await rawBody.text()
    assert.deepStrictEqual(body, 'REQUEST')
  }

  // Hostname access with prefix should not work
  {
    const { statusCode } = await request(address, {
      method: 'GET',
      path: '/service/id',
      headers: {
        host: 'service.example.com'
      }
    })
    assert.equal(statusCode, 404)
  }

  // All other hostnames are permitted
  {
    const { statusCode, body: rawBody } = await request(address, {
      method: 'POST',
      headers: {
        host: 'whatever.example.com',
        'content-type': 'text/plain'
      },
      path: '/service/echo',
      body: 'REQUEST'
    })
    assert.equal(statusCode, 200)

    const body = await rawBody.text()
    assert.deepStrictEqual(body, 'REQUEST')
  }

  // Other hostnames also work
  {
    const { statusCode, body: rawBody } = await request(address, {
      method: 'GET',
      headers: {
        host: 'node.example.com'
      },
      path: '/id'
    })
    assert.equal(statusCode, 200)

    const body = await rawBody.json()
    assert.deepStrictEqual(body, { from: 'node' })
  }

  {
    const { statusCode, body: rawBody } = await request(address, {
      method: 'POST',
      headers: {
        'content-type': 'text/plain'
      },
      path: '/node/id',
      body: 'REQUEST'
    })
    assert.equal(statusCode, 200)

    const body = await rawBody.json()
    assert.deepStrictEqual(body, { from: 'node' })
  }

  {
    const { statusCode } = await request(address, {
      method: 'POST',
      path: '/node/id',
      headers: {
        host: 'node.example.com',
        'content-type': 'text/plain'
      },
      body: 'REQUEST'
    })
    assert.equal(statusCode, 404)
  }

  // Routes are not mixed between hostnames
  // The route is defined on the "service" service but not on the "node" service, we therefore forbid access
  {
    const { statusCode } = await request(address, {
      method: 'POST',
      path: '/echo',
      headers: {
        host: 'node.example.com',
        'content-type': 'text/plain'
      },
      body: 'REQUEST'
    })
    assert.equal(statusCode, 404)
  }
})

test('should properly allow all domains when a service is the only one with a hostname', async t => {
  const nodeModulesRoot = resolve(__dirname, './proxy/fixtures/node/node_modules')

  await ensureCleanup(t, [nodeModulesRoot])

  // Make sure there is @platformatic/node available in the node service.
  // We can't simply specify it in the package.json due to circular dependencies.
  await createDirectory(resolve(nodeModulesRoot, '@platformatic'))
  await symlink(resolve(__dirname, '../../node'), resolve(nodeModulesRoot, '@platformatic/node'), 'dir')

  const runtime = await createComposerInRuntime(
    t,
    'base-path-no-configuration',
    {
      composer: {
        refreshTimeout: REFRESH_TIMEOUT,
        services: [
          {
            id: 'service',
            proxy: { hostname: 'service.example.com' }
          },
          {
            id: 'node'
          }
        ]
      }
    },
    [
      {
        id: 'node',
        path: resolve(__dirname, './proxy/fixtures/node')
      },
      {
        id: 'service',
        path: resolve(__dirname, './proxy/fixtures/service')
      }
    ]
  )

  const address = await runtime.start()

  {
    const { statusCode, body: rawBody } = await request(address, {
      method: 'GET',
      path: '/id',
      headers: {
        host: 'service.example.com'
      }
    })
    assert.equal(statusCode, 200)

    const body = await rawBody.json()
    assert.deepStrictEqual(body, { from: 'service' })
  }

  {
    const { statusCode, body: rawBody } = await request(address, {
      method: 'POST',
      headers: {
        host: 'service.example.com',
        'content-type': 'text/plain'
      },
      path: '/echo',
      body: 'REQUEST'
    })
    assert.equal(statusCode, 200)

    const body = await rawBody.text()
    assert.deepStrictEqual(body, 'REQUEST')
  }

  {
    const { statusCode } = await request(address, {
      method: 'GET',
      path: '/service/id',
      headers: {
        host: 'service.example.com'
      }
    })
    assert.equal(statusCode, 404)
  }

  {
    const { statusCode, body: rawBody } = await request(address, {
      method: 'GET',
      headers: {
        host: 'node.example.com'
      },
      path: '/node/id'
    })
    assert.equal(statusCode, 200)

    const body = await rawBody.json()
    assert.deepStrictEqual(body, { from: 'node' })
  }

  // All other hostnames are permitted
  {
    const { statusCode, body: rawBody } = await request(address, {
      method: 'POST',
      headers: {
        host: 'whatever.example.com',
        'content-type': 'text/plain'
      },
      path: '/service/echo',
      body: 'REQUEST'
    })
    assert.equal(statusCode, 200)

    const body = await rawBody.text()
    assert.deepStrictEqual(body, 'REQUEST')
  }
})

test('should properly generate OpenAPI routes when a frontend is exposed on /', async t => {
  const astroModulesRoot = resolve(__dirname, './proxy/fixtures/astro/node_modules')

  await ensureCleanup(t, [astroModulesRoot, resolve(__dirname, './proxy/fixtures/astro/.astro')])

  // Make sure there is @platformatic/astro available in the astro service.
  // We can't simply specify it in the package.json due to circular dependencies.
  await createDirectory(resolve(astroModulesRoot, '@platformatic'))
  await symlink(resolve(__dirname, '../../astro'), resolve(astroModulesRoot, '@platformatic/astro'), 'dir')

  const runtime = await createComposerInRuntime(
    t,
    'openapi-with-frontend',
    {
      composer: {
        refreshTimeout: REFRESH_TIMEOUT,
        services: [
          {
            id: 'backend',
            openapi: {
              url: '/documentation/json',
              prefix: '/api'
            }
          },
          {
            id: 'frontend',
            proxy: {
              prefix: '/'
            }
          }
        ]
      }
    },
    [
      {
        id: 'backend',
        path: resolve(__dirname, './proxy/fixtures/service')
      },
      {
        id: 'frontend',
        path: resolve(__dirname, './proxy/fixtures/astro')
      }
    ]
  )

  const address = await runtime.start()

  {
    const { statusCode, body: rawBody } = await request(address, {
      method: 'GET',
      path: '/'
    })
    assert.equal(statusCode, 200)

    const body = await rawBody.text()
    assert.ok(body.includes('Hello from Astro'))
  }

  {
    const { statusCode, body: rawBody } = await request(address, {
      method: 'GET',
      path: '/api/id'
    })
    assert.equal(statusCode, 200)

    const body = await rawBody.json()
    assert.deepStrictEqual(body, { from: 'service' })
  }

  {
    const { statusCode, body: rawBody } = await request(address, {
      method: 'GET',
      path: '/documentation/openapi.json'
    })
    assert.equal(statusCode, 200)

    const body = await rawBody.json()

    assert.ok(body.paths['/api/id'])
    assert.ok(body.paths['/api/hello'])
  }
})

test('adds x-forwarded-proto', async t => {
  const { certificate, privateKey } = selfCert({})
  const localDir = tmpdir()
  const tmpDir = await mkdtemp(join(localDir, 'plt-composer-proxy-https-test-'))
  const privateKeyPath = join(tmpDir, 'plt.key')
  const certificatePath = join(tmpDir, 'plt.cert')

  await writeFile(privateKeyPath, privateKey)
  await writeFile(certificatePath, certificate)

  {
    const previousDispatcher = getGlobalDispatcher()
    setGlobalDispatcher(
      new Agent({
        connect: {
          rejectUnauthorized: false
        }
      })
    )
    t.after(() => {
      setGlobalDispatcher(previousDispatcher)
    })
  }

  const nodeModulesRoot = resolve(__dirname, './proxy/fixtures/node/node_modules')

  await ensureCleanup(t, [nodeModulesRoot])

  // Make sure there is @platformatic/node available in the node service.
  // We can't simply specify it in the package.json due to circular dependencies.
  await createDirectory(resolve(nodeModulesRoot, '@platformatic'))
  await symlink(resolve(__dirname, '../../node'), resolve(nodeModulesRoot, '@platformatic/node'), 'dir')

  const runtime = await createComposerInRuntime(
    t,
    'composer-prefix-in-conf',
    {
      server: {
        https: {
          key: {
            path: privateKeyPath
          },
          cert: {
            path: certificatePath
          }
        }
      },
      composer: {
        services: [
          {
            id: 'main',
            proxy: {
              prefix: '/whatever'
            }
          }
        ],
        refreshTimeout: REFRESH_TIMEOUT
      }
    },
    [
      {
        id: 'main',
        path: resolve(__dirname, './proxy/fixtures/node')
      }
    ]
  )

  const address = await runtime.start()

  {
    const { statusCode, body } = await request(address, {
      method: 'GET',
      path: '/whatever/headers'
    })
    assert.equal(statusCode, 200)

    const parsed = await body.json()

    assert.equal(parsed.headers['x-forwarded-proto'], 'https')
  }
})

test('should rewrite Location headers for proxied services https', async t => {
  const nodeModulesRoot = resolve(__dirname, './proxy/fixtures/node/node_modules')

  await ensureCleanup(t, [nodeModulesRoot])

  // Make sure there is @platformatic/node available in the node service.
  // We can't simply specify it in the package.json due to circular dependencies.
  await createDirectory(resolve(nodeModulesRoot, '@platformatic'))
  await symlink(resolve(__dirname, '../../node'), resolve(nodeModulesRoot, '@platformatic/node'), 'dir')

  const { certificate, privateKey } = selfCert({})
  const localDir = tmpdir()
  const tmpDir = await mkdtemp(join(localDir, 'plt-composer-proxy-https-test-'))
  const privateKeyPath = join(tmpDir, 'plt.key')
  const certificatePath = join(tmpDir, 'plt.cert')

  await writeFile(privateKeyPath, privateKey)
  await writeFile(certificatePath, certificate)

  {
    const previousDispatcher = getGlobalDispatcher()
    setGlobalDispatcher(
      new Agent({
        connect: {
          rejectUnauthorized: false
        }
      })
    )
    t.after(() => {
      setGlobalDispatcher(previousDispatcher)
    })
  }

  const runtime = await createComposerInRuntime(
    t,
    'composer-prefix-in-conf',
    {
      server: {
        https: {
          key: {
            path: privateKeyPath
          },
          cert: {
            path: certificatePath
          }
        }
      },
      composer: {
        services: [
          {
            id: 'main',
            proxy: {
              prefix: '/whatever'
            }
          }
        ],
        refreshTimeout: REFRESH_TIMEOUT
      }
    },
    [
      {
        id: 'main',
        path: resolve(__dirname, './proxy/fixtures/node')
      }
    ]
  )

  const address = await runtime.start()

  {
    const {
      statusCode,
      body: rawBody,
      headers
    } = await request(address, {
      method: 'GET',
      path: '/whatever/redirect-secure'
    })
    assert.equal(statusCode, 307)
    assert.equal(headers.location, '/whatever/id')

    rawBody.dump()
  }
})

test('should properly strip runtime basePath from proxied services', async t => {
  const remixModulesRoot = resolve(__dirname, './proxy/fixtures/remix/node_modules')

  await ensureCleanup(t, [remixModulesRoot, resolve(__dirname, './proxy/fixtures/remix/build')])

  // Make sure there is @platformatic/remix available in the node service.
  // We can't simply specify it in the package.json due to circular dependencies.
  await createDirectory(resolve(remixModulesRoot, '@platformatic'))
  await symlink(resolve(__dirname, '../../remix'), resolve(remixModulesRoot, '@platformatic/remix'), 'dir')

  const runtime = await createComposerInRuntime(
    t,
    'base-path-no-configuration',
    {
      composer: {
        refreshTimeout: REFRESH_TIMEOUT,
        services: [
          {
            id: 'remix'
          }
        ]
      }
    },
    [
      {
        id: 'remix',
        path: resolve(__dirname, './proxy/fixtures/remix')
      }
    ],
    null,
    {
      basePath: '/base'
    },
    true,
    async runtimeConfigPath => {
      const devRuntime = await buildRuntime(runtimeConfigPath)
      await devRuntime.buildService('remix')
      await devRuntime.close()
    }
  )

  const address = await runtime.start()

  const { statusCode, body: rawBody } = await request(address, {
    method: 'GET',
    path: '/base/remix/'
  })
  assert.equal(statusCode, 200)

  const body = await rawBody.text()

  // Check the index works
  assert.ok(body.match(/Hello from v<!-- -->\d+<\/div>/))

  // Check that asset works
  const scriptUrl = body.match(/<link rel="modulepreload" href="([a-z0-9.\-_/]+\.js)"\/>/i)[1]
  assert.ok(scriptUrl.startsWith('/base/remix/'))

  {
    const { statusCode, headers } = await request(address, {
      method: 'GET',
      path: scriptUrl
    })

    assert.equal(statusCode, 200)
    assert.ok(headers['content-type'].startsWith('application/javascript'))
  }

  const composerConfig = await runtime.getServiceMeta('composer', 'getMeta')
  const remixConfig = await runtime.getServiceMeta('remix', 'getMeta')

  assert.equal(composerConfig.composer.proxies.remix.prefix, '/remix')
  assert.equal(composerConfig.composer.proxies.remix.rewritePrefix, '/base/remix/')
  assert.equal(remixConfig.composer.prefix, '/base/remix/')
})

test('should properly handle basePath root for generic services', async t => {
  const nodeModulesRoot = resolve(__dirname, './proxy/fixtures/node/node_modules')

  await ensureCleanup(t, [nodeModulesRoot])

  // Make sure there is @platformatic/node available in the node service.
  // We can't simply specify it in the package.json due to circular dependencies.
  await createDirectory(resolve(nodeModulesRoot, '@platformatic'))
  await symlink(resolve(__dirname, '../../node'), resolve(nodeModulesRoot, '@platformatic/node'), 'dir')

  const runtime = await createComposerInRuntime(
    t,
    'base-path-no-configuration',
    {
      composer: {
        refreshTimeout: REFRESH_TIMEOUT,
        services: [
          {
            id: 'node'
          }
        ]
      }
    },
    [
      {
        id: 'node',
        path: resolve(__dirname, './proxy/fixtures/node'),
        config: 'platformatic.with-absolute-url.json'
      }
    ],
    null,
    {
      basePath: '/base'
    },
    true
  )

  const address = await runtime.start()

  {
    const { statusCode, body: rawBody } = await request(address, {
      method: 'GET',
      path: '/node'
    })
    assert.equal(statusCode, 404)

    const body = await rawBody.json()
    assert.deepStrictEqual(body, { ok: false, url: '/node/' })
  }
})

test('should proxy to a websocket service', async t => {
  const { service, wsServer } = await createWebsocketService(t)
  wsServer.on('connection', socket => {
    socket.on('message', message => {
      socket.send(message)
    })
  })
  const port = service.address().port

  const upstream = `http://127.0.0.1:${port}`
  const wsUpstream = `ws://127.0.0.1:${port}`

  const proxyConfig = {
    id: 'to-ws',
    proxy: {
      prefix: '/',
      upstream,
      ws: { upstream: wsUpstream }
    }
  }

  const composer = await createFromConfig(t, {
    server: {
      logger: {
        level: 'fatal'
      }
    },
    composer: {
      services: [proxyConfig]
    }
  })

  const composerOrigin = await composer.start({ listen: true })
  const client = new WebSocket(composerOrigin.replace('http://', 'ws://'))

  const { promise, resolve } = Promise.withResolvers()
  client.on('message', message => {
    resolve(message.toString())
  })

  await once(client, 'open')
  client.send('hello')

  assert.deepStrictEqual(await promise, 'hello')

  client.close()
})

test('should proxy to a websocket service with reconnect options', async t => {
  globalThis.foo = new EventEmitter()
  const { service: wsService, wsServer } = await createWebsocketService(t, { autoPong: false })
  wsServer.on('connection', socket => {
    socket.on('message', message => {
      socket.send(message)
    })
  })
  const port = wsService.address().port

  const upstream = `http://127.0.0.1:${port}`
  const wsUpstream = `ws://127.0.0.1:${port}`

  const proxyConfig = {
    id: 'to-ws',
    proxy: {
      upstream,
      prefix: '/',
      ws: {
        upstream: wsUpstream,
        reconnect: {
          pingInterval: 500,
          maxReconnectionRetries: 9,
          reconnectInterval: 100,
          reconnectDecay: 1,
          connectionTimeout: 500,
          reconnectOnClose: true,
          logs: true
        },
        hooks: {
          path: resolve(__dirname, './proxy/fixtures/ws/hooks.js')
        }
      }
    }
  }

  const composer = await createFromConfig(t, {
    server: {
      logger: {
        level: 'fatal'
      }
    },
    composer: {
      services: [proxyConfig]
    }
  })

  const composerOrigin = await composer.start({ listen: true })
  globalThis.platformatic.events ??= new EventEmitter()

  const client = new WebSocket(composerOrigin.replace('http://', 'ws://'))
  await once(client, 'open')
  client.send('hello')

  await once(globalThis.platformatic.events, 'proxy:onIncomingMessage')

  await once(globalThis.platformatic.events, 'onConnect')
  await once(globalThis.platformatic.events, 'onOutgoingMessage')

  // close the target to cause reconnection
  await wsService.close()
  await wsServer.close()

  await createWebsocketService(t, {}, port)

  await once(globalThis.platformatic.events, 'onReconnect')
  await once(globalThis.platformatic.events, 'onPong')

  client.close()

  await once(globalThis.platformatic.events, 'onDisconnect')
})
