import { generateRequest } from '@platformatic/itc'
import { withResolvers } from '@platformatic/utils'
import { deepStrictEqual, ok } from 'node:assert'
import { once } from 'node:events'
import { createServer } from 'node:http'
import { platform } from 'node:os'
import { test } from 'node:test'
import { WebSocket } from 'ws'
import { exitCodes } from '../../lib/errors.js'
import { ChildManager } from '../../lib/worker/child-manager.js'
import { createMockedLogger } from '../helper.js'

function serverHandler (_, res) {
  res.writeHead(200, {
    'content-type': 'application/json',
    connection: 'close'
  })

  res.end(JSON.stringify({ ok: true }))
}

function createLogger () {
  const { messages, logger } = createMockedLogger()

  globalThis.platformatic ??= {}
  globalThis.platformatic.logger = logger

  return messages
}

test('ChildManager - listen - should log when receiving invalid messages', async t => {
  const messages = createLogger()
  const manager = new ChildManager({})

  await manager.listen()
  const protocol = platform() === 'win32' ? 'ws+unix:' : 'ws+unix://'
  const socket = new WebSocket(`${protocol}${manager.getSocketPath()}`)

  socket.on('open', () => {
    socket.send('NO-WAY')
  })

  const { promise, resolve } = withResolvers()
  t.mock.method(process, 'exit', code => {
    resolve(code)
  })

  deepStrictEqual(await promise, exitCodes.MANAGER_MESSAGE_HANDLING_FAILED)

  socket.close()
  await manager.close()

  deepStrictEqual(messages[0][1].err.message, `Unexpected token 'N', "NO-WAY" is not valid JSON`)
})

test('ChildManager - listen - should handle fetch request', async t => {
  createLogger()

  const server = createServer(serverHandler).listen({ host: '127.0.0.1', port: 10000 })
  await new Promise((resolve, reject) => {
    return server.listen(0, resolve).on('error', reject)
  })

  const manager = new ChildManager({})

  await manager.listen()
  const protocol = platform() === 'win32' ? 'ws+unix:' : 'ws+unix://'
  const socket = new WebSocket(`${protocol}${manager.getSocketPath()}`)

  socket.on('open', () => {
    socket.send(JSON.stringify(generateRequest('fetch', { origin: `http://127.0.0.1:${server.address().port}` })))
  })

  const [message] = await once(socket, 'message')

  deepStrictEqual(JSON.parse(Buffer.from(message)).data.statusCode, 200)

  server.close()
  socket.close()
  await manager.close()
})

test('ChildManager - send - should not fail when a client is missing', async t => {
  createLogger()
  const manager = new ChildManager({})

  await manager.listen()

  manager.send(undefined, 'name', { reqId: 'foo' })
  manager._send({ reqId: 'foo' })
  manager._manageKeepAlive()

  await manager.close()
})

test('ChildManager - register - can register a local loader', async t => {
  createLogger()
  const manager = new ChildManager({ loader: new URL('../fixtures/loader.js', import.meta.url) })

  manager.register()

  const { loaded } = await import(new URL('../fixtures/non-existing.js', import.meta.url))
  await manager.close()

  ok(loaded)
})
