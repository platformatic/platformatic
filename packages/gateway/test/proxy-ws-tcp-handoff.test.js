import { createDirectory, executeWithTimeout, kTimeout, safeRemove } from '@platformatic/foundation'
import assert from 'assert/strict'
import { once } from 'node:events'
import { symlink } from 'node:fs/promises'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { setTimeout as sleep } from 'node:timers/promises'
import { request } from 'undici'
import { WebSocket } from 'ws'
import { createGatewayInRuntime, REFRESH_TIMEOUT } from './helper.js'

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

async function connectAndEcho (address, path = '/echo/') {
  // The timeouts make sure a single attempt cannot hang the test: when the
  // gateway dials a dead port, @fastify/http-proxy completes the client
  // handshake anyway and the echo message simply never arrives.
  const client = new WebSocket(`${address.replace('http://', 'ws://')}${path}`, { handshakeTimeout: 3000 })

  try {
    await once(client, 'open')

    client.send('hello')
    const result = await executeWithTimeout(once(client, 'message'), 3000)
    if (result === kTimeout) {
      throw new Error('the WebSocket echo timed out')
    }

    assert.equal(result[0].toString(), 'hello')
  } catch (err) {
    client.terminate()
    throw err
  }

  client.close()
  await once(client, 'close')
}

test('should proxy WebSocket connections to a node application using the websocket flag', async t => {
  await prepareEchoWsFixture(t)

  const runtime = await createGatewayInRuntime(
    t,
    'gateway-ws-handoff-node',
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
        websocket: true
      }
    ]
  )

  const address = await runtime.start()

  // The WebSocket upgrade must succeed with no manual proxy.ws wiring
  await connectAndEcho(address)

  // HTTP requests must keep being proxied
  const { statusCode, body: rawBody } = await request(address, {
    method: 'GET',
    path: '/echo/'
  })

  assert.equal(statusCode, 200)
  const payload = await rawBody.json()
  assert.equal(payload.service, 'echo')
})

test('should proxy WebSocket connections to a service application using the websocket flag', async t => {
  const runtime = await createGatewayInRuntime(
    t,
    'gateway-ws-handoff-service',
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
        path: resolve(import.meta.dirname, './ws/fixtures/echo-ws-service'),
        websocket: true
      }
    ]
  )

  const address = await runtime.start()

  // The WebSocket upgrade must succeed with no manual proxy.ws wiring
  await connectAndEcho(address)

  // HTTP requests must keep being proxied through the mesh
  const { statusCode, body: rawBody } = await request(address, {
    method: 'GET',
    path: '/echo/'
  })

  assert.equal(statusCode, 200)
  const payload = await rawBody.json()
  assert.equal(payload.service, 'echo-service')
})

test('should dial a fresh TCP port after the application is restarted', async t => {
  await prepareEchoWsFixture(t)

  const runtime = await createGatewayInRuntime(
    t,
    'gateway-ws-handoff-restart',
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
        websocket: true
      }
    ]
  )

  const address = await runtime.start()

  const portBefore = new URL((await runtime.getApplicationMeta('echo')).gateway.url).port
  await connectAndEcho(address)

  await runtime.restartApplication('echo')

  // The restarted worker binds a new ephemeral port
  const portAfter = new URL((await runtime.getApplicationMeta('echo')).gateway.url).port
  assert.notEqual(portAfter, portBefore)

  // New WebSocket connections must reach the new port. The gateway refreshes its
  // upstream asynchronously when the worker start event is delivered, so retry
  // for a short while: without the refresh this loop can never succeed, since the
  // gateway would keep dialing the dead port.
  const deadline = Date.now() + 10000
  let lastError

  while (Date.now() < deadline) {
    try {
      await connectAndEcho(address)
      lastError = null
      break
    } catch (err) {
      lastError = err
      await sleep(200)
    }
  }

  if (lastError) {
    throw lastError
  }
})
