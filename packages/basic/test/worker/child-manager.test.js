import { deepStrictEqual, ok } from 'node:assert'
import { platform } from 'node:os'
import { test } from 'node:test'
import { WebSocket } from 'ws'
import { exitCodes } from '../../lib/errors.js'
import { ChildManager } from '../../lib/worker/child-manager.js'

function createLogger () {
  const messages = []
  const verbose = process.env.PLT_TESTS_VERBOSE === 'true'

  const logger = {
    debug (message) {
      messages.push(['DEBUG', message])

      if (verbose) {
        process._rawDebug(['DEBUG', message])
      }
    },
    info (message) {
      messages.push(['INFO', message])

      if (verbose) {
        process._rawDebug(['INFO', message])
      }
    },
    error (message) {
      messages.push(['ERROR', message])

      if (verbose) {
        process._rawDebug(['ERROR', message])
      }
    }
  }

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

  const { promise, resolve } = Promise.withResolvers()
  t.mock.method(process, 'exit', code => {
    resolve(code)
  })

  deepStrictEqual(await promise, exitCodes.MANAGER_MESSAGE_HANDLING_FAILED)

  socket.close()
  await manager.close()

  deepStrictEqual(messages[0][1].err.message, 'Unexpected token \'N\', "NO-WAY" is not valid JSON')
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
