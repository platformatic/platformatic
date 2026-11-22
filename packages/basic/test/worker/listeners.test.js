import { updateGlobals } from '@platformatic/globals'
import { deepStrictEqual, ok, rejects } from 'node:assert'
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { createServer as createNetServer } from 'node:net'
import { test } from 'node:test'
import { createChildProcessListener, createServerListener, isBareHttpServer } from '../../lib/worker/listeners.js'

async function listen (server, opts) {
  return new Promise((resolve, reject) => {
    server.listen(opts, resolve).on('error', reject)
  })
}

function createHttpServer (t) {
  const server = createServer()
  t.after(() => server.close())

  return server
}

test('createServerListener - should return the first listening server without changing its options', async t => {
  const server = createHttpServer(t)
  const options = { host: '127.0.0.1', port: 0 }

  const listener = createServerListener()
  await listen(server, options)

  const listened = await listener
  deepStrictEqual(server, listened)
  deepStrictEqual(server.address().address, options.host)
})

test('createServerListener - should preserve a fixed port', async t => {
  const first = createHttpServer(t)
  await listen(first, { host: '127.0.0.1', port: 0 })
  const port = first.address().port
  await new Promise(resolve => first.close(resolve))

  const server = createHttpServer(t)
  const listener = createServerListener()
  await listen(server, { host: '127.0.0.1', port })

  await listener
  deepStrictEqual(server.address().port, port)
})

test('createServerListener - applies timeouts without overriding listener options', async t => {
  const server = createHttpServer(t)
  const intercepted = []
  updateGlobals({ events: { emitAndNotify: (_, options) => intercepted.push(options) } })
  t.after(() => updateGlobals({ events: undefined }))

  const listener = createServerListener({ keepAliveTimeout: 65000, headersTimeout: 66000 })
  await listen(server, { host: '127.0.0.1', port: 0, backlog: 42 })

  deepStrictEqual(await listener, server)
  deepStrictEqual(server.keepAliveTimeout, 65000)
  deepStrictEqual(server.headersTimeout, 66000)
  deepStrictEqual(intercepted[0].host, '127.0.0.1')
  deepStrictEqual(intercepted[0].port, 0)
  deepStrictEqual(intercepted[0].backlog, 42)
  ok(!('keepAliveTimeout' in intercepted[0]))
  ok(!('headersTimeout' in intercepted[0]))
})

test('createServerListener - preserves default timeouts when not configured', async t => {
  const server = createHttpServer(t)
  const defaults = { keepAliveTimeout: server.keepAliveTimeout, headersTimeout: server.headersTimeout }
  const listener = createServerListener()
  await listen(server, { port: 0 })
  await listener

  deepStrictEqual({ keepAliveTimeout: server.keepAliveTimeout, headersTimeout: server.headersTimeout }, defaults)
})

test('createServerListener - handle errors', async t => {
  const server = createHttpServer(t)

  const listener = createServerListener()
  server.listen({ path: '/invalid/path' }).on('error', () => {})

  await rejects(() => listener, /EACCES/)
})

// Vite 8 and later look for a free port by opening and closing throwaway TCP servers before
// binding the dev server. Those probes must not be returned in place of the application server.
test('createServerListener - should ignore port probes without changing the server options', async t => {
  const server = createHttpServer(t)

  const intercepted = []
  updateGlobals({ events: { emitAndNotify: (_, options) => intercepted.push(options) } })
  t.after(() => updateGlobals({ events: undefined }))

  const listener = createServerListener()

  const probe = createNetServer()
  await listen(probe, { host: '127.0.0.1', port: 0 })
  const probePort = probe.address().port
  await new Promise(resolve => probe.close(resolve))

  await listen(server, { host: '127.0.0.1', port: 0 })

  const listened = await listener
  deepStrictEqual(listened, server)
  ok(listened.address().port !== probePort)

  // Observe both listens without overriding the application's options.
  deepStrictEqual(intercepted.length, 2)
  ok(intercepted.every(options => options.host === '127.0.0.1' && options.port === 0))
})

test('createServerListener - should not reject when a port probe fails', async t => {
  const blocker = createNetServer()
  t.after(() => blocker.close())
  await listen(blocker, { host: '127.0.0.1', port: 0 })
  const taken = blocker.address().port

  const server = createHttpServer(t)
  const listener = createServerListener()

  // A probe on an already bound port errors, but the framework recovers by picking another one
  const probe = createNetServer()
  probe.on('error', () => probe.close())
  probe.listen({ host: '127.0.0.1', port: taken })
  await new Promise(resolve => probe.once('error', resolve))

  await listen(server, { host: '127.0.0.1', port: 0 })

  deepStrictEqual(await listener, server)
})

test('createServerListener - is cancelable', async () => {
  const listener = createServerListener()
  listener.cancel()
  deepStrictEqual(await listener, null)
})

test('createServerListener - should return the first spawned process', async () => {
  const listener = createChildProcessListener()

  const subprocess = spawn('node', ['-e', 'Date.now()'])

  const listened = await listener
  deepStrictEqual(subprocess, listened)
})

test('createChildProcessListener - is cancelable', async () => {
  const listener = createChildProcessListener()
  listener.cancel()
  deepStrictEqual(await listener, null)
})

// The Nuxt CLI 4 and later probe SO_REUSEPORT support by binding HTTP servers without any handler
// before the dev server. Those are told apart from the application server by their listeners.
test('isBareHttpServer - should only match HTTP servers without any application handler', async () => {
  ok(isBareHttpServer(createServer()))
  ok(!isBareHttpServer(createServer(() => {})))
  ok(!isBareHttpServer(createNetServer()))

  const upgradable = createServer()
  upgradable.on('upgrade', () => {})
  ok(!isBareHttpServer(upgradable))

  const late = createServer()
  ok(isBareHttpServer(late))
  late.on('request', () => {})
  ok(!isBareHttpServer(late))
})
