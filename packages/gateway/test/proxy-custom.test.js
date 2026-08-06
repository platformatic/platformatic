import { createDirectory, safeRemove } from '@platformatic/foundation'
import assert from 'assert/strict'
import { once } from 'node:events'
import { symlink } from 'node:fs/promises'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { request } from 'undici'
import { WebSocket } from 'ws'
import {
  createApplication,
  createFromConfig,
  createGatewayInRuntime,
  createWebsocketApplication,
  REFRESH_TIMEOUT
} from './helper.js'

function ensureCleanup (t, folders) {
  function cleanup () {
    return Promise.all(folders.map(safeRemove))
  }

  t.after(cleanup)
  return cleanup()
}

async function createNamedApplication (t, name) {
  const app = await createApplication(t, [
    {
      method: 'GET',
      path: '/whoami',
      handler: async (_req, res) => {
        return res.send({ from: name })
      }
    }
  ])

  const origin = await app.listen({ port: 0 })
  return origin
}

test('should select the upstream via custom getUpstream using a request header or a cookie and pass custom.options to the module', async t => {
  const oneOrigin = await createNamedApplication(t, 'one')
  const twoOrigin = await createNamedApplication(t, 'two')

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
            prefix: '/',
            custom: {
              path: resolve(import.meta.dirname, './proxy/fixtures/custom-header-cookie.js'),
              options: {
                header: 'x-plt-version',
                cookie: 'plt-version',
                upstreams: { one: oneOrigin, two: twoOrigin },
                fallback: oneOrigin
              }
            }
          }
        }
      ]
    }
  })

  const gatewayOrigin = await gateway.start({ listen: true })

  {
    // Select the upstream via a request header
    const { statusCode, headers, body: rawBody } = await request(gatewayOrigin, {
      method: 'GET',
      path: '/whoami',
      headers: { 'x-plt-version': 'two' }
    })

    assert.equal(statusCode, 200)
    assert.deepStrictEqual(await rawBody.json(), { from: 'two' })

    // The custom rewriteHeaders hook added a Set-Cookie header to the proxied response
    assert.ok(headers['set-cookie'].includes('plt-version=two'))
  }

  {
    // Select the upstream via a cookie
    const { statusCode, headers, body: rawBody } = await request(gatewayOrigin, {
      method: 'GET',
      path: '/whoami',
      headers: { cookie: 'foo=bar; plt-version=two' }
    })

    assert.equal(statusCode, 200)
    assert.deepStrictEqual(await rawBody.json(), { from: 'two' })
    assert.ok(headers['set-cookie'].includes('plt-version=two'))
  }

  {
    // No header and no cookie - use the fallback from custom.options
    const { statusCode, headers, body: rawBody } = await request(gatewayOrigin, {
      method: 'GET',
      path: '/whoami'
    })

    assert.equal(statusCode, 200)
    assert.deepStrictEqual(await rawBody.json(), { from: 'one' })
    assert.equal(headers['set-cookie'], undefined)
  }
})

test('should support custom onError hooks', async t => {
  // Get a port which is guaranteed to be closed
  const app = await createApplication(t)
  const origin = await app.listen({ port: 0 })
  await app.close()
  globalThis.customProxyUnreachableUpstream = origin

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
            prefix: '/',
            custom: {
              path: resolve(import.meta.dirname, './proxy/fixtures/custom-on-error.js')
            }
          }
        }
      ]
    }
  })

  const gatewayOrigin = await gateway.start({ listen: true })

  const { statusCode, body: rawBody } = await request(gatewayOrigin, {
    method: 'GET',
    path: '/whoami'
  })

  assert.equal(statusCode, 503)
  const body = await rawBody.json()
  assert.equal(body.handled, true)
})

test('should route requests via the runtime mesh to applications not listed in the gateway configuration', async t => {
  const echoModulesRoot = resolve(import.meta.dirname, './proxy/fixtures/echo/node_modules')

  await ensureCleanup(t, [echoModulesRoot])

  // Make sure there is @platformatic/node available in the echo application.
  // We can't simply specify it in the package.json due to circular dependencies.
  await createDirectory(resolve(echoModulesRoot, '@platformatic'))
  await symlink(resolve(import.meta.dirname, '../../node'), resolve(echoModulesRoot, '@platformatic/node'), 'dir')

  const runtime = await createGatewayInRuntime(
    t,
    'gateway-custom-mesh',
    {
      gateway: {
        // Note: only "main" is listed here, "version-one" and "version-two" are not
        applications: [
          {
            id: 'main',
            proxy: {
              prefix: '/',
              custom: {
                path: resolve(import.meta.dirname, './proxy/fixtures/custom-mesh.js'),
                options: {
                  header: 'x-plt-version',
                  cookie: 'plt-version',
                  fallback: 'main'
                }
              }
            }
          }
        ],
        refreshTimeout: REFRESH_TIMEOUT
      }
    },
    [
      {
        id: 'main',
        path: resolve(import.meta.dirname, './proxy/fixtures/echo')
      },
      {
        id: 'version-one',
        path: resolve(import.meta.dirname, './proxy/fixtures/echo')
      },
      {
        id: 'version-two',
        path: resolve(import.meta.dirname, './proxy/fixtures/echo')
      }
    ]
  )

  const { 'composer:0': address } = await runtime.start()

  {
    // No header and no cookie - use the fallback from custom.options
    const { statusCode, body: rawBody } = await request(address, {
      method: 'GET',
      path: '/'
    })

    assert.equal(statusCode, 200)
    assert.deepStrictEqual(await rawBody.json(), { service: 'main' })
  }

  {
    // Select an application not listed in the gateway configuration via a request header
    const { statusCode, body: rawBody } = await request(address, {
      method: 'GET',
      path: '/',
      headers: { 'x-plt-version': 'version-one' }
    })

    assert.equal(statusCode, 200)
    assert.deepStrictEqual(await rawBody.json(), { service: 'version-one' })
  }

  {
    // Select an application not listed in the gateway configuration via a cookie
    const { statusCode, body: rawBody } = await request(address, {
      method: 'GET',
      path: '/',
      headers: { cookie: 'plt-version=version-two' }
    })

    assert.equal(statusCode, 200)
    assert.deepStrictEqual(await rawBody.json(), { service: 'version-two' })
  }
})

test('should select the WebSocket upstream per-connection via custom getUpstream', async t => {
  const { application: wsApplicationOne, wsServer: wsServerOne } = await createWebsocketApplication(t)
  wsServerOne.on('connection', socket => {
    socket.send('ws-one')
  })

  const { application: wsApplicationTwo, wsServer: wsServerTwo } = await createWebsocketApplication(t)
  wsServerTwo.on('connection', socket => {
    socket.send('ws-two')
  })

  const oneOrigin = `http://127.0.0.1:${wsApplicationOne.address().port}`
  const twoOrigin = `http://127.0.0.1:${wsApplicationTwo.address().port}`

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
            prefix: '/',
            custom: {
              path: resolve(import.meta.dirname, './proxy/fixtures/custom-ws.js'),
              options: {
                header: 'x-plt-version',
                upstreams: { one: oneOrigin, two: twoOrigin, default: oneOrigin }
              }
            }
          }
        }
      ]
    }
  })

  const gatewayOrigin = await gateway.start({ listen: true })

  async function firstMessage (headers) {
    const client = new WebSocket(gatewayOrigin.replace('http://', 'ws://'), { headers })
    const [message] = await once(client, 'message')
    client.close()
    return message.toString()
  }

  assert.equal(await firstMessage({ 'x-plt-version': 'one' }), 'ws-one')
  assert.equal(await firstMessage({ 'x-plt-version': 'two' }), 'ws-two')
  assert.equal(await firstMessage({}), 'ws-one')
})
