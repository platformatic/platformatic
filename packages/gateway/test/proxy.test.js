import { sleepImmediate } from '@platformatic/basic/test/helper.js'
import { createDirectory, safeRemove } from '@platformatic/foundation'
import assert from 'assert/strict'
import { EventEmitter, once } from 'node:events'
import { mkdtemp, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { test } from 'node:test'
import openAPISchemaValidator from 'openapi-schema-validator'
import client from 'prom-client'
import selfCert from 'self-cert'
import { Agent, getGlobalDispatcher, request, setGlobalDispatcher } from 'undici'
import { WebSocket } from 'ws'
import { create as createRuntime } from '../../runtime/index.js'
import {
  createApplication,
  createFromConfig,
  createGatewayInRuntime,
  createOpenApiApplication,
  createWebsocketApplication,
  REFRESH_TIMEOUT,
  testEntityRoutes
} from './helper.js'

const OpenAPISchemaValidator = openAPISchemaValidator.default
const openApiValidator = new OpenAPISchemaValidator({ version: 3 })

function ensureCleanup (t, folders) {
  function cleanup () {
    return Promise.all(folders.map(safeRemove))
  }

  t.after(cleanup)
  return cleanup()
}

test('should increment and decrement activeWsConnections metric', async t => {
  const initPromClient = globalThis.platformatic?.prometheus
  const prometheusRegistry = new client.Registry()

  if (!initPromClient) {
    globalThis.platformatic = { ...globalThis.platformatic, prometheus: { registry: prometheusRegistry, client } }
  }

  const { application, wsServer } = await createWebsocketApplication(t)
  wsServer.on('connection', socket => {
    socket.on('message', message => {
      setTimeout(() => {
        socket.send(message)
      }, 500)
    })
  })
  const port = application.address().port

  const upstream = `http://127.0.0.1:${port}`
  const wsUpstream = `ws://127.0.0.1:${port}`

  const config = {
    server: {
      logger: {
        level: 'fatal'
      }
    },
    gateway: {
      applications: [
        {
          id: 'to-ws',
          proxy: {
            prefix: '/',
            upstream,
            ws: { upstream: wsUpstream }
          }
        }
      ]
    }
  }

  const gateway = await createFromConfig(t, config)
  const gatewayOrigin = await gateway.start({ listen: true })

  async function getActiveConnections () {
    const metrics = await prometheusRegistry.metrics()
    const match = metrics.match(/active_ws_gateway_connections.+\s(\d+)$/m)
    return match ? parseInt(match[1]) : 0
  }

  // Test: Start with 0 connections
  assert.equal(await getActiveConnections(), 0)

  // Test: Create first connection, should increment to 1
  const client1 = new WebSocket(gatewayOrigin.replace('http://', 'ws://'))
  await once(client1, 'open')
  client1.send('hello')
  const [response1] = await once(client1, 'message')
  assert.equal(response1.toString(), 'hello')
  assert.equal(await getActiveConnections(), 1)

  // Test: Create second connection, should increment to 2
  const client2 = new WebSocket(gatewayOrigin.replace('http://', 'ws://'))
  await once(client2, 'open')
  client2.send('hello2')
  const [response2] = await once(client2, 'message')
  assert.equal(response2.toString(), 'hello2')
  assert.equal(await getActiveConnections(), 2)

  // Test: Close first connection, should decrement to 1
  client1.close()
  await once(client1, 'close')
  await sleepImmediate()
  assert.equal(await getActiveConnections(), 1)

  // Test: Close second connection, should decrement to 0
  client2.close()
  await once(client2, 'close')
  await sleepImmediate()
  assert.equal(await getActiveConnections(), 0)

  await gateway.close()
  globalThis.platformatic.prometheus = initPromClient
})

test('should proxy openapi requests', async t => {
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
            prefix: '/'
          }
        }
      ],
      refreshTimeout: 1000
    }
  }

  const gateway = await createFromConfig(t, config)
  const gatewayOrigin = await gateway.start({ listen: true })

  const { statusCode, body } = await request(gatewayOrigin, {
    method: 'GET',
    path: '/documentation/json'
  })
  assert.equal(statusCode, 200)

  const openApiSchema = await body.json()
  openApiValidator.validate(openApiSchema)

  for (const path in openApiSchema.paths) {
    for (const application of config.gateway.applications) {
      const proxyPrefix =
        application.proxy.prefix.at(-1) === '/' ? application.proxy.prefix.slice(0, -1) : application.proxy.prefix

      if (path === proxyPrefix + '/' || path === proxyPrefix + '/*') {
        assert.fail('proxy routes should be removed from openapi schema')
      }
    }
  }

  {
    const { statusCode, body } = await request(gatewayOrigin, {
      method: 'GET',
      path: '/internal/service1/documentation/json'
    })
    assert.equal(statusCode, 200)

    const openApiSchema = await body.json()
    openApiValidator.validate(openApiSchema)

    await testEntityRoutes(gatewayOrigin, ['/users'])
    await testEntityRoutes(gatewayOrigin, ['/internal/service1/users'])
  }

  {
    const { statusCode, body } = await request(gatewayOrigin, {
      method: 'GET',
      path: '/internal/service2/documentation/json'
    })
    assert.equal(statusCode, 200)

    const openApiSchema = await body.json()
    openApiValidator.validate(openApiSchema)

    await testEntityRoutes(gatewayOrigin, ['/posts'])
    await testEntityRoutes(gatewayOrigin, ['/internal/service2/posts'])
  }

  {
    const { statusCode, body } = await request(gatewayOrigin, {
      method: 'GET',
      path: '/internal/service1/headers'
    })
    assert.equal(statusCode, 200)

    const returnedHeaders = await body.json()

    const expectedForwardedHost = gatewayOrigin.replace('http://', '')
    const [expectedForwardedFor] = expectedForwardedHost.split(':')
    assert.equal(returnedHeaders['x-forwarded-host'], expectedForwardedHost)
    assert.equal(returnedHeaders['x-forwarded-for'], expectedForwardedFor)
  }
})

test('should proxy a @platformatic/service to its prefix by default', async t => {
  const runtime = await createGatewayInRuntime(
    t,
    'gateway-default-prefix',
    {
      gateway: {
        applications: [
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
        path: resolve(import.meta.dirname, './proxy/fixtures/service')
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
  const runtime = await createGatewayInRuntime(
    t,
    'gateway-prefix-in-conf',
    {
      gateway: {
        applications: [
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
        path: resolve(import.meta.dirname, './proxy/fixtures/service'),
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
  const runtime = await createGatewayInRuntime(
    t,
    'gateway-prefix-in-code',
    {
      gateway: {
        applications: [
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
        path: resolve(import.meta.dirname, './proxy/fixtures/service'),
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

test('should proxy all applications if none are defined', async t => {
  const nodeModulesRoot = resolve(import.meta.dirname, './proxy/fixtures/node/node_modules')

  await ensureCleanup(t, [nodeModulesRoot])

  // Make sure there is @platformatic/node available in the node application.
  // We can't simply specify it in the package.json due to circular dependencies.
  await createDirectory(resolve(nodeModulesRoot, '@platformatic'))
  await symlink(resolve(import.meta.dirname, '../../node'), resolve(nodeModulesRoot, '@platformatic/node'), 'dir')

  const runtime = await createGatewayInRuntime(
    t,
    'gateway-prefix-in-code',
    {
      gateway: {
        refreshTimeout: REFRESH_TIMEOUT
      }
    },
    [
      {
        id: 'first',
        path: resolve(import.meta.dirname, './proxy/fixtures/service'),
        config: 'platformatic.json'
      },
      {
        id: 'second',
        path: resolve(import.meta.dirname, './proxy/fixtures/service'),
        config: 'platformatic.json'
      },
      {
        id: 'third',
        path: resolve(import.meta.dirname, './proxy/fixtures/node')
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
  const nodeModulesRoot = resolve(import.meta.dirname, './proxy/fixtures/node/node_modules')
  const astroModulesRoot = resolve(import.meta.dirname, './proxy/fixtures/astro/node_modules')

  await ensureCleanup(t, [
    nodeModulesRoot,
    astroModulesRoot,
    resolve(import.meta.dirname, './proxy/fixtures/astro/.astro')
  ])

  // Make sure there is @platformatic/node available in the node application.
  // We can't simply specify it in the package.json due to circular dependencies.
  await createDirectory(resolve(nodeModulesRoot, '@platformatic'))
  await symlink(resolve(import.meta.dirname, '../../node'), resolve(nodeModulesRoot, '@platformatic/node'), 'dir')

  // Make sure there is @platformatic/astro available in the astro application.
  // We can't simply specify it in the package.json due to circular dependencies.
  await createDirectory(resolve(astroModulesRoot, '@platformatic'))
  await symlink(resolve(import.meta.dirname, '../../astro'), resolve(astroModulesRoot, '@platformatic/astro'), 'dir')

  const runtime = await createGatewayInRuntime(
    t,
    'referer-redirect',
    {
      gateway: {
        refreshTimeout: REFRESH_TIMEOUT
      }
    },
    [
      {
        id: 'first',
        path: resolve(import.meta.dirname, './proxy/fixtures/service'),
        config: 'platformatic.json'
      },
      {
        id: 'astro',
        path: resolve(import.meta.dirname, './proxy/fixtures/astro'),
        config: 'platformatic.json'
      },
      {
        id: 'third',
        path: resolve(import.meta.dirname, './proxy/fixtures/node')
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

test('should rewrite Location headers for proxied applications', async t => {
  const runtime = await createGatewayInRuntime(
    t,
    'gateway-prefix-in-conf',
    {
      gateway: {
        applications: [
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
        path: resolve(import.meta.dirname, './proxy/fixtures/service'),
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

test('should rewrite Location headers that include full url of the running application', async t => {
  const nodeModulesRoot = resolve(import.meta.dirname, './proxy/fixtures/node/node_modules')

  await ensureCleanup(t, [nodeModulesRoot])

  // Make sure there is @platformatic/node available in the node application.
  // We can't simply specify it in the package.json due to circular dependencies.
  await createDirectory(resolve(nodeModulesRoot, '@platformatic'))
  await symlink(resolve(import.meta.dirname, '../../node'), resolve(nodeModulesRoot, '@platformatic/node'), 'dir')

  const runtime = await createGatewayInRuntime(
    t,
    'gateway-prefix-in-conf',
    {
      gateway: {
        applications: [
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
        path: resolve(import.meta.dirname, './proxy/fixtures/node')
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

test('should properly configure the frontends on their paths if no gateway configuration is present', async t => {
  const echoModulesRoot = resolve(import.meta.dirname, './proxy/fixtures/echo/node_modules')
  const nodeModulesRoot = resolve(import.meta.dirname, './proxy/fixtures/node/node_modules')
  const astroModulesRoot = resolve(import.meta.dirname, './proxy/fixtures/astro/node_modules')
  const nextModulesRoot = resolve(import.meta.dirname, './proxy/fixtures/next/node_modules')
  const remixModulesRoot = resolve(import.meta.dirname, './proxy/fixtures/remix/node_modules')

  await ensureCleanup(t, [
    echoModulesRoot,
    nodeModulesRoot,
    astroModulesRoot,
    nextModulesRoot,
    remixModulesRoot,
    resolve(import.meta.dirname, './proxy/fixtures/astro/.astro'),
    resolve(import.meta.dirname, './proxy/fixtures/next/.next')
  ])

  // Make sure there is @platformatic/node available in the echo application.
  // We can't simply specify it in the package.json due to circular dependencies.
  await createDirectory(resolve(echoModulesRoot, '@platformatic'))
  await symlink(resolve(import.meta.dirname, '../../node'), resolve(echoModulesRoot, '@platformatic/node'), 'dir')

  // Make sure there is @platformatic/node available in the node application.
  // We can't simply specify it in the package.json due to circular dependencies.
  await createDirectory(resolve(nodeModulesRoot, '@platformatic'))
  await symlink(resolve(import.meta.dirname, '../../node'), resolve(nodeModulesRoot, '@platformatic/node'), 'dir')

  // Make sure there is @platformatic/astro available in the astro application.
  // We can't simply specify it in the package.json due to circular dependencies.
  await createDirectory(resolve(astroModulesRoot, '@platformatic'))
  await symlink(resolve(import.meta.dirname, '../../astro'), resolve(astroModulesRoot, '@platformatic/astro'), 'dir')

  // Make sure there is @platformatic/next available in the next application.
  // We can't simply specify it in the package.json due to circular dependencies.
  await createDirectory(resolve(nextModulesRoot, '@platformatic'))
  await symlink(resolve(import.meta.dirname, '../../next'), resolve(nextModulesRoot, '@platformatic/next'), 'dir')

  // Make sure there is @platformatic/next available in the next application.
  // We can't simply specify it in the package.json due to circular dependencies.
  await createDirectory(resolve(remixModulesRoot, '@platformatic'))
  await symlink(resolve(import.meta.dirname, '../../remix'), resolve(remixModulesRoot, '@platformatic/remix'), 'dir')

  const runtime = await createGatewayInRuntime(
    t,
    'base-path-no-configuration',
    {
      gateway: {
        refreshTimeout: REFRESH_TIMEOUT
      }
    },
    [],
    resolve(import.meta.dirname, './proxy/fixtures/')
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

test('should properly match applications by their hostname', async t => {
  const nodeModulesRoot = resolve(import.meta.dirname, './proxy/fixtures/node/node_modules')

  await ensureCleanup(t, [nodeModulesRoot])

  // Make sure there is @platformatic/node available in the node application.
  // We can't simply specify it in the package.json due to circular dependencies.
  await createDirectory(resolve(nodeModulesRoot, '@platformatic'))
  await symlink(resolve(import.meta.dirname, '../../node'), resolve(nodeModulesRoot, '@platformatic/node'), 'dir')

  const runtime = await createGatewayInRuntime(
    t,
    'base-path-no-configuration',
    {
      gateway: {
        refreshTimeout: REFRESH_TIMEOUT,
        applications: [
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
        path: resolve(import.meta.dirname, './proxy/fixtures/node')
      },
      {
        id: 'service',
        path: resolve(import.meta.dirname, './proxy/fixtures/service')
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
  // The route is defined on the "application" application but not on the "node" application, we therefore forbid access
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

test('should properly allow all domains when a application is the only one with a hostname', async t => {
  const nodeModulesRoot = resolve(import.meta.dirname, './proxy/fixtures/node/node_modules')

  await ensureCleanup(t, [nodeModulesRoot])

  // Make sure there is @platformatic/node available in the node application.
  // We can't simply specify it in the package.json due to circular dependencies.
  await createDirectory(resolve(nodeModulesRoot, '@platformatic'))
  await symlink(resolve(import.meta.dirname, '../../node'), resolve(nodeModulesRoot, '@platformatic/node'), 'dir')

  const runtime = await createGatewayInRuntime(
    t,
    'base-path-no-configuration',
    {
      gateway: {
        refreshTimeout: REFRESH_TIMEOUT,
        applications: [
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
        path: resolve(import.meta.dirname, './proxy/fixtures/node')
      },
      {
        id: 'service',
        path: resolve(import.meta.dirname, './proxy/fixtures/service')
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
  const astroModulesRoot = resolve(import.meta.dirname, './proxy/fixtures/astro/node_modules')

  await ensureCleanup(t, [astroModulesRoot, resolve(import.meta.dirname, './proxy/fixtures/astro/.astro')])

  // Make sure there is @platformatic/astro available in the astro application.
  // We can't simply specify it in the package.json due to circular dependencies.
  await createDirectory(resolve(astroModulesRoot, '@platformatic'))
  await symlink(resolve(import.meta.dirname, '../../astro'), resolve(astroModulesRoot, '@platformatic/astro'), 'dir')

  const runtime = await createGatewayInRuntime(
    t,
    'openapi-with-frontend',
    {
      gateway: {
        refreshTimeout: REFRESH_TIMEOUT,
        applications: [
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
        path: resolve(import.meta.dirname, './proxy/fixtures/service')
      },
      {
        id: 'frontend',
        path: resolve(import.meta.dirname, './proxy/fixtures/astro')
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
  const tmpDir = await mkdtemp(join(localDir, 'plt-gateway-proxy-https-test-'))
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

  const nodeModulesRoot = resolve(import.meta.dirname, './proxy/fixtures/node/node_modules')

  await ensureCleanup(t, [nodeModulesRoot])

  // Make sure there is @platformatic/node available in the node application.
  // We can't simply specify it in the package.json due to circular dependencies.
  await createDirectory(resolve(nodeModulesRoot, '@platformatic'))
  await symlink(resolve(import.meta.dirname, '../../node'), resolve(nodeModulesRoot, '@platformatic/node'), 'dir')

  const runtime = await createGatewayInRuntime(
    t,
    'gateway-prefix-in-conf',
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
      gateway: {
        applications: [
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
        path: resolve(import.meta.dirname, './proxy/fixtures/node')
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

test('should rewrite Location headers for proxied applications https', async t => {
  const nodeModulesRoot = resolve(import.meta.dirname, './proxy/fixtures/node/node_modules')

  await ensureCleanup(t, [nodeModulesRoot])

  // Make sure there is @platformatic/node available in the node application.
  // We can't simply specify it in the package.json due to circular dependencies.
  await createDirectory(resolve(nodeModulesRoot, '@platformatic'))
  await symlink(resolve(import.meta.dirname, '../../node'), resolve(nodeModulesRoot, '@platformatic/node'), 'dir')

  const { certificate, privateKey } = selfCert({})
  const localDir = tmpdir()
  const tmpDir = await mkdtemp(join(localDir, 'plt-gateway-proxy-https-test-'))
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

  const runtime = await createGatewayInRuntime(
    t,
    'gateway-prefix-in-conf',
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
      gateway: {
        applications: [
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
        path: resolve(import.meta.dirname, './proxy/fixtures/node')
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

test('should properly strip runtime basePath from proxied applications', async t => {
  const remixModulesRoot = resolve(import.meta.dirname, './proxy/fixtures/remix/node_modules')

  await ensureCleanup(t, [remixModulesRoot, resolve(import.meta.dirname, './proxy/fixtures/remix/build')])

  // Make sure there is @platformatic/remix available in the node application.
  // We can't simply specify it in the package.json due to circular dependencies.
  await createDirectory(resolve(remixModulesRoot, '@platformatic'))
  await symlink(resolve(import.meta.dirname, '../../remix'), resolve(remixModulesRoot, '@platformatic/remix'), 'dir')

  const runtime = await createGatewayInRuntime(
    t,
    'base-path-no-configuration',
    {
      gateway: {
        refreshTimeout: REFRESH_TIMEOUT,
        applications: [
          {
            id: 'remix'
          }
        ]
      }
    },
    [
      {
        id: 'remix',
        path: resolve(import.meta.dirname, './proxy/fixtures/remix')
      }
    ],
    null,
    {
      basePath: '/base'
    },
    true,
    async runtimeConfigPath => {
      const devRuntime = await createRuntime(runtimeConfigPath)
      await devRuntime.init()
      await devRuntime.buildApplication('remix')
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

  const gatewayConfig = await runtime.getApplicationMeta('composer', 'getMeta')
  const remixConfig = await runtime.getApplicationMeta('remix', 'getMeta')

  assert.equal(gatewayConfig.gateway.proxies.remix.prefix, '/remix')
  assert.equal(gatewayConfig.gateway.proxies.remix.rewritePrefix, '/base/remix/')
  assert.equal(remixConfig.gateway.prefix, '/base/remix/')
})

test('should properly handle basePath root for generic applications', async t => {
  const nodeModulesRoot = resolve(import.meta.dirname, './proxy/fixtures/node/node_modules')

  await ensureCleanup(t, [nodeModulesRoot])

  // Make sure there is @platformatic/node available in the node application.
  // We can't simply specify it in the package.json due to circular dependencies.
  await createDirectory(resolve(nodeModulesRoot, '@platformatic'))
  await symlink(resolve(import.meta.dirname, '../../node'), resolve(nodeModulesRoot, '@platformatic/node'), 'dir')

  const runtime = await createGatewayInRuntime(
    t,
    'base-path-no-configuration',
    {
      gateway: {
        refreshTimeout: REFRESH_TIMEOUT,
        applications: [
          {
            id: 'node'
          }
        ]
      }
    },
    [
      {
        id: 'node',
        path: resolve(import.meta.dirname, './proxy/fixtures/node'),
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

test('should proxy to a websocket application', async t => {
  const { application, wsServer } = await createWebsocketApplication(t)
  wsServer.on('connection', socket => {
    socket.on('message', message => {
      socket.send(message)
    })
  })
  const port = application.address().port

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

  const gateway = await createFromConfig(t, {
    server: {
      logger: {
        level: 'fatal'
      }
    },
    gateway: {
      applications: [proxyConfig]
    }
  })

  const gatewayOrigin = await gateway.start({ listen: true })
  const client = new WebSocket(gatewayOrigin.replace('http://', 'ws://'))

  const { promise, resolve } = Promise.withResolvers()
  client.on('message', message => {
    resolve(message.toString())
  })

  await once(client, 'open')
  client.send('hello')

  assert.deepStrictEqual(await promise, 'hello')

  client.close()
})

test('should proxy to a websocket application with reconnect options', async t => {
  globalThis.foo = new EventEmitter()
  const { application: wsApplication, wsServer } = await createWebsocketApplication(t, { autoPong: false })
  wsServer.on('connection', socket => {
    socket.on('message', message => {
      socket.send(message)
    })
  })
  const port = wsApplication.address().port

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
          path: resolve(import.meta.dirname, './proxy/fixtures/ws/hooks.js')
        }
      }
    }
  }

  const gateway = await createFromConfig(t, {
    server: {
      logger: {
        level: 'fatal'
      }
    },
    gateway: {
      applications: [proxyConfig]
    }
  })

  const gatewayOrigin = await gateway.start({ listen: true })
  globalThis.platformatic.events ??= new EventEmitter()

  const client = new WebSocket(gatewayOrigin.replace('http://', 'ws://'))
  await once(client, 'open')
  client.send('hello')

  await once(globalThis.platformatic.events, 'proxy:onIncomingMessage')

  await once(globalThis.platformatic.events, 'onConnect')
  await once(globalThis.platformatic.events, 'onOutgoingMessage')

  // close the target to cause reconnection
  await wsApplication.close()
  await wsServer.close()

  await createWebsocketApplication(t, {}, port)

  await once(globalThis.platformatic.events, 'onReconnect')
  await once(globalThis.platformatic.events, 'onPong')

  client.close()

  await once(globalThis.platformatic.events, 'onDisconnect')
})

test('should dynamically proxy a using custom logic', async t => {
  const one = await createApplication(t, [
    {
      method: 'POST',
      path: '/',
      handler: async (_req, res) => {
        return res.send({ message: 'from one' })
      }
    }
  ])
  const two = await createApplication(t, [
    {
      method: 'POST',
      path: '/',
      handler: async (_req, res) => {
        return res.send({ message: 'from two' })
      }
    }
  ])
  const oneOrigin = await one.listen({ port: 0 })
  const twoOrigin = await two.listen({ port: 0 })

  globalThis.customProxyServiceOne = oneOrigin
  globalThis.customProxyServiceTwo = twoOrigin

  const { application: wsApplication, wsServer } = await createWebsocketApplication(t, { autoPong: false })
  wsServer.on('connection', socket => {
    socket.on('message', message => {
      socket.send(message)
    })
  })
  const wsUpstream = `ws://127.0.0.1:${wsApplication.address().port}`

  const gateway = await createFromConfig(t, {
    server: {
      logger: {
        level: 'fatal'
      }
    },
    gateway: {
      applications: [
        {
          id: 'the-proxy',
          proxy: {
            custom: { path: resolve(import.meta.dirname, './proxy/fixtures/custom.ts') },
            upstream: oneOrigin,
            prefix: '/',
            ws: { upstream: wsUpstream }
          }
        }
      ]
    }
  })

  const gatewayOrigin = await gateway.start({ listen: true })

  {
    // run preValidation
    const { statusCode, body: rawBody } = await request(gatewayOrigin, {
      method: 'POST',
      path: '/',
      body: 'go to one',
      headers: {
        'content-type': 'text/plain'
      }
    })
    assert.equal(statusCode, 400)
    const body = await rawBody.json()
    assert.deepStrictEqual(body, { error: 'Content-Type must be application/json' })
  }

  {
    const { statusCode, body: rawBody } = await request(gatewayOrigin, {
      method: 'POST',
      path: '/',
      body: JSON.stringify({ message: 'go to one' }),
      headers: {
        'content-type': 'application/json'
      }
    })
    assert.equal(statusCode, 200)
    const body = await rawBody.json()
    assert.deepStrictEqual(body, { message: 'from one' })
  }

  {
    const { statusCode, body: rawBody } = await request(gatewayOrigin, {
      method: 'POST',
      path: '/',
      body: JSON.stringify({ message: 'go to two' }),
      headers: {
        'content-type': 'application/json'
      }
    })

    assert.equal(statusCode, 200)
    const body = await rawBody.json()
    assert.deepStrictEqual(body, { message: 'from two' })
  }

  {
    const client = new WebSocket(gatewayOrigin.replace('http://', 'ws://'))
    await once(client, 'open')
    client.send('hello')
    const [message] = await once(client, 'message')
    assert.deepStrictEqual(message.toString(), 'hello')
    client.close()
  }
})

test('should proxy to a remote service with external origin', async t => {
  // Create an external service (simulating a remote API)
  const remoteService = await createOpenApiApplication(t, ['users'])
  const remoteOrigin = await remoteService.listen({ port: 0 })

  // Configure gateway with a remote application using origin (not part of runtime)
  // This tests that remote services work without being part of the runtime
  const config = {
    server: {
      logger: {
        level: 'fatal'
      }
    },
    gateway: {
      applications: [
        {
          id: 'remote-users',
          origin: remoteOrigin,
          openapi: {
            url: '/documentation/json'
          },
          proxy: {
            prefix: '/api/users'
          }
        }
      ]
    }
  }

  const gateway = await createFromConfig(t, config)
  const gatewayOrigin = await gateway.start({ listen: true })

  // Test that requests are proxied to the remote service
  await testEntityRoutes(gatewayOrigin, ['/api/users/users'])

  // Test that openapi spec is available and contains the users entity
  const { statusCode, body } = await request(gatewayOrigin, {
    method: 'GET',
    path: '/documentation/json'
  })
  assert.equal(statusCode, 200)
  const openApiSchema = await body.json()
  // OpenAPI composition uses the application's paths prefixed appropriately
  const paths = Object.keys(openApiSchema.paths)
  assert.ok(
    paths.some(p => p.includes('users')),
    `Expected a users path, got: ${paths.join(', ')}`
  )
})

test('should proxy to a remote service from gateway in runtime', async t => {
  // Create an external service (simulating a remote API not part of the runtime)
  const remoteService = await createOpenApiApplication(t, ['products'])
  const remoteOrigin = await remoteService.listen({ port: 0 })

  // Create a gateway in a runtime that proxies to the external remote service
  // This is the scenario from issue #4531 - remote services should work
  // without throwing "Application not found"
  const runtime = await createGatewayInRuntime(
    t,
    'gateway-remote-proxy',
    {
      gateway: {
        applications: [
          {
            id: 'remote-products',
            origin: remoteOrigin,
            openapi: {
              url: '/documentation/json'
            },
            proxy: {
              prefix: '/api/products'
            }
          }
        ],
        refreshTimeout: REFRESH_TIMEOUT
      }
    },
    [] // No local services - only remote external service
  )

  const address = await runtime.start()

  // Test that requests are proxied to the remote external service
  await testEntityRoutes(address, ['/api/products/products'])
})

test('should proxy both local and remote services in same runtime', async t => {
  // Create an external service (simulating a remote API not part of the runtime)
  const remoteService = await createOpenApiApplication(t, ['products'])
  const remoteOrigin = await remoteService.listen({ port: 0 })

  // Create a gateway in runtime with BOTH local and remote services
  // This tests that local services still get ITC metadata while remote services work without it
  const runtime = await createGatewayInRuntime(
    t,
    'gateway-mixed-local-remote',
    {
      gateway: {
        applications: [
          {
            // Local service - part of the runtime, should use ITC for metadata
            id: 'main',
            proxy: {
              prefix: '/local'
            }
          },
          {
            // Remote service - NOT part of runtime, should skip ITC
            id: 'remote-products',
            origin: remoteOrigin,
            openapi: {
              url: '/documentation/json'
            },
            proxy: {
              prefix: '/remote'
            }
          }
        ],
        refreshTimeout: REFRESH_TIMEOUT
      }
    },
    [
      {
        // The actual local service definition
        id: 'main',
        path: resolve(import.meta.dirname, './proxy/fixtures/service')
      }
    ]
  )

  const address = await runtime.start()

  // Test local service works (uses ITC for metadata)
  {
    const { statusCode, body: rawBody } = await request(address, {
      method: 'GET',
      path: '/local/hello'
    })
    assert.equal(statusCode, 200)
    const body = await rawBody.json()
    assert.deepStrictEqual(body, { ok: true })
  }

  // Test remote service works (skips ITC)
  await testEntityRoutes(address, ['/remote/products'])
})

test('should handle methods and routes options', async t => {
  const echoModulesRoot = resolve(import.meta.dirname, './proxy/fixtures/echo/node_modules')

  await ensureCleanup(t, [echoModulesRoot])

  // Make sure there is @platformatic/node available in the echo application.
  // We can't simply specify it in the package.json due to circular dependencies.
  await createDirectory(resolve(echoModulesRoot, '@platformatic'))
  await symlink(resolve(import.meta.dirname, '../../node'), resolve(echoModulesRoot, '@platformatic/node'), 'dir')

  const runtime = await createGatewayInRuntime(
    t,
    'gateway-methods-routes',
    {
      gateway: {
        applications: [
          {
            // First receives all POST on prefix /first
            id: 'first',
            proxy: {
              prefix: '/',
              routes: ['/first/*'],
              methods: ['POST']
            }
          },
          {
            // Second receives all GETs
            id: 'second',
            proxy: {
              prefix: '/',
              methods: ['GET']
            }
          },
          {
            // Third receives everything else
            id: 'third',
            proxy: {
              prefix: '/',
              methods: ['POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS']
            }
          }
        ],
        refreshTimeout: REFRESH_TIMEOUT
      }
    },
    [
      {
        id: 'first',
        path: resolve(import.meta.dirname, './proxy/fixtures/echo')
      },
      {
        id: 'second',
        path: resolve(import.meta.dirname, './proxy/fixtures/echo')
      },
      {
        id: 'third',
        path: resolve(import.meta.dirname, './proxy/fixtures/echo')
      }
    ]
  )

  const address = await runtime.start()

  {
    const { statusCode, body: rawBody } = await request(address, { method: 'POST', path: '/first/abc/cde' })
    assert.equal(statusCode, 200)
    const body = await rawBody.json()
    assert.deepStrictEqual(body, { service: 'first' })
  }

  {
    const { statusCode, body: rawBody } = await request(address, { method: 'POST', path: '/whatever' })
    assert.equal(statusCode, 200)
    const body = await rawBody.json()
    assert.deepStrictEqual(body, { service: 'third' })
  }

  {
    const { statusCode, body: rawBody } = await request(address, { method: 'GET', path: '/first/abc/cde' })
    assert.equal(statusCode, 200)
    const body = await rawBody.json()
    assert.deepStrictEqual(body, { service: 'second' })
  }

  {
    const { statusCode, body: rawBody } = await request(address, { method: 'DELETE', path: '/first/abc/cde' })
    assert.equal(statusCode, 200)
    const body = await rawBody.json()
    assert.deepStrictEqual(body, { service: 'third' })
  }
})
