import { createDirectory, executeWithTimeout, kTimeout, safeRemove } from '@platformatic/foundation'
import assert from 'assert/strict'
import { once } from 'node:events'
import { symlink } from 'node:fs/promises'
import { resolve } from 'node:path'
import { test } from 'node:test'
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

test('should proxy WebSocket connections to a node application', async t => {
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
        path: resolve(import.meta.dirname, './ws/fixtures/echo-ws')
      }
    ]
  )

  const { 'composer:0': address } = await runtime.start()

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

test('should proxy WebSocket connections to a service application', async t => {
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
        path: resolve(import.meta.dirname, './ws/fixtures/echo-ws-service')
      }
    ]
  )

  const { 'composer:0': address } = await runtime.start()

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
