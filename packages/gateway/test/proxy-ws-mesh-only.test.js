import { createDirectory, executeWithTimeout, kTimeout, safeRemove } from '@platformatic/foundation'
import assert from 'assert/strict'
import { once } from 'node:events'
import { symlink } from 'node:fs/promises'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { request } from 'undici'
import { WebSocket } from 'ws'
import { createFromConfig, createGatewayInRuntime, createWebsocketApplication, REFRESH_TIMEOUT } from './helper.js'

const echoWsModulesRoot = resolve(import.meta.dirname, './ws/fixtures/echo-ws/node_modules')

function ensureCleanup (t, folders) {
  function cleanup () {
    return Promise.all(folders.map(safeRemove))
  }

  t.after(cleanup)
  return cleanup()
}

async function prepareEchoWsFixture (t) {
  await ensureCleanup(t, [echoWsModulesRoot])

  // Make sure there is @platformatic/node available in the echo-ws application.
  // We can't simply specify it in the package.json due to circular dependencies.
  await createDirectory(resolve(echoWsModulesRoot, '@platformatic'))
  await symlink(resolve(import.meta.dirname, '../../node'), resolve(echoWsModulesRoot, '@platformatic/node'), 'dir')
}

async function assertGuardRejection (url, applicationId) {
  const client = new WebSocket(url)

  const result = await executeWithTimeout(once(client, 'unexpected-response'), 10000)
  assert.notEqual(result, kTimeout, 'the WebSocket upgrade should fail fast instead of hanging')

  const [req, res] = result
  assert.equal(res.statusCode, 502)

  let body = ''
  res.setEncoding('utf-8')
  for await (const chunk of res) {
    body += chunk
  }

  const payload = JSON.parse(body)
  assert.equal(payload.code, 'PLT_GATEWAY_WS_NO_TCP_UPSTREAM')
  assert.ok(payload.message.includes(`"${applicationId}" application`), `unexpected error message: ${payload.message}`)

  req.destroy()
}

test('should reject a WebSocket upgrade to a mesh-only application with a coded error', async t => {
  await prepareEchoWsFixture(t)

  const runtime = await createGatewayInRuntime(
    t,
    'gateway-ws-mesh-only',
    {
      gateway: {
        applications: [
          {
            id: 'echo',
            proxy: {
              prefix: '/echo'
            }
          }
        ],
        refreshTimeout: REFRESH_TIMEOUT
      }
    },
    [
      {
        id: 'echo',
        path: resolve(import.meta.dirname, './ws/fixtures/echo-ws')
      }
    ]
  )

  const address = await runtime.start()

  // HTTP requests to the mesh-only application must keep working, including raw body passthrough
  {
    const { statusCode, body: rawBody } = await request(address, {
      method: 'GET',
      path: '/echo/'
    })

    assert.equal(statusCode, 200)
    const payload = await rawBody.json()
    assert.equal(payload.service, 'echo')
  }

  {
    const requestBody = JSON.stringify({ hello: 'world' })
    const { statusCode, body: rawBody } = await request(address, {
      method: 'POST',
      path: '/echo/',
      headers: { 'content-type': 'application/json' },
      body: requestBody
    })

    assert.equal(statusCode, 200)
    const payload = await rawBody.json()
    assert.equal(payload.method, 'POST')
    assert.equal(payload.body, requestBody)
  }

  // The WebSocket upgrade must fail fast with the coded error
  await assertGuardRejection(`${address.replace('http://', 'ws://')}/echo/`, 'echo')
})

test('should proxy WebSocket connections when the application exposes a TCP server', async t => {
  await prepareEchoWsFixture(t)

  const runtime = await createGatewayInRuntime(
    t,
    'gateway-ws-tcp',
    {
      gateway: {
        applications: [
          {
            id: 'echo',
            proxy: {
              prefix: '/echo'
            }
          }
        ],
        refreshTimeout: REFRESH_TIMEOUT
      }
    },
    [
      {
        id: 'echo',
        path: resolve(import.meta.dirname, './ws/fixtures/echo-ws'),
        useHttp: true
      }
    ]
  )

  const address = await runtime.start()

  const client = new WebSocket(`${address.replace('http://', 'ws://')}/echo/`)
  await once(client, 'open')

  client.send('hello')
  const [response] = await once(client, 'message')
  assert.equal(response.toString(), 'hello')

  client.close()
  await once(client, 'close')
})

test('should warn at boot when proxy.ws is explicitly configured for a mesh-only application', async t => {
  const messages = []
  const logger = {
    warn: msg => {
      messages.push(msg)
    },
    error: () => {},
    info: () => {},
    debug: () => {},
    fatal: () => {},
    trace: () => {},
    child: () => logger
  }

  const gateway = await createFromConfig(t, {
    server: {
      loggerInstance: logger
    },
    gateway: {
      applications: [
        {
          id: 'mesh-ws',
          proxy: {
            prefix: '/mesh-ws',
            ws: {
              reconnect: {
                pingInterval: 1000
              }
            }
          }
        },
        {
          id: 'mesh-plain',
          proxy: {
            prefix: '/mesh-plain'
          }
        }
      ]
    }
  })

  await gateway.start({ listen: true })

  const wsWarnings = messages.filter(m => typeof m === 'string' && m.includes('WebSocket upgrades to this application will fail'))
  assert.equal(wsWarnings.length, 1)
  assert.ok(wsWarnings[0].includes('"mesh-ws"'))
})

test('should keep proxying WebSocket connections to an application with an external origin', async t => {
  const { application, wsServer } = await createWebsocketApplication(t)
  wsServer.on('connection', socket => {
    socket.on('message', message => {
      socket.send(message)
    })
  })
  const port = application.address().port

  const gateway = await createFromConfig(t, {
    server: {
      logger: {
        level: 'fatal'
      }
    },
    gateway: {
      applications: [
        {
          id: 'external-ws',
          origin: `http://127.0.0.1:${port}`,
          proxy: {
            prefix: '/'
          }
        }
      ]
    }
  })

  const gatewayOrigin = await gateway.start({ listen: true })

  // No ws.upstream and no custom.getUpstream: the WebSocket upstream falls back to the
  // external origin and the guard must not trigger.
  const client = new WebSocket(gatewayOrigin.replace('http://', 'ws://'))
  await once(client, 'open')

  client.send('hello')
  const [response] = await once(client, 'message')
  assert.equal(response.toString(), 'hello')

  client.close()
  await once(client, 'close')
})

test('should compose the guard with a user configured custom preValidation hook', async t => {
  await prepareEchoWsFixture(t)

  const runtime = await createGatewayInRuntime(
    t,
    'gateway-ws-composition',
    {
      gateway: {
        applications: [
          {
            id: 'echo',
            proxy: {
              prefix: '/echo',
              custom: {
                path: resolve(import.meta.dirname, './proxy/fixtures/custom-pre-validation.js')
              }
            }
          }
        ],
        refreshTimeout: REFRESH_TIMEOUT
      }
    },
    [
      {
        id: 'echo',
        path: resolve(import.meta.dirname, './ws/fixtures/echo-ws')
      }
    ]
  )

  const address = await runtime.start()

  // The user configured preValidation hook must keep running for HTTP requests
  {
    const { statusCode, body: rawBody } = await request(address, {
      method: 'GET',
      path: '/echo/',
      headers: { 'x-plt-intercept': 'true' }
    })

    assert.equal(statusCode, 418)
    assert.deepStrictEqual(await rawBody.json(), { intercepted: true })
  }

  // Regular HTTP requests must still be proxied
  {
    const { statusCode, body: rawBody } = await request(address, {
      method: 'GET',
      path: '/echo/'
    })

    assert.equal(statusCode, 200)
    const payload = await rawBody.json()
    assert.equal(payload.service, 'echo')
  }

  // The WebSocket upgrade must still be rejected by the guard
  await assertGuardRejection(`${address.replace('http://', 'ws://')}/echo/`, 'echo')
})
