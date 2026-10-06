import { updateGlobals } from '@platformatic/globals'
import getPort from 'get-port'
import { deepStrictEqual, ok, rejects } from 'node:assert'
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { createServer as createNetServer } from 'node:net'
import { test } from 'node:test'
import { createChildProcessListener, createServerListener } from '../../lib/worker/listeners.js'

async function listen (server, opts) {
  return new Promise((resolve, reject) => {
    server.listen(opts, resolve).on('error', reject)
  })
}

function createHttpServer (t, listener) {
  const server = createServer()
  t.after(() => server.close())

  return server
}

test('createServerListener - should return the first listening server', async t => {
  const server = createHttpServer(t)

  const listener = createServerListener()
  await listen(server, { host: '127.0.0.1', port: 0 })

  const listened = await listener
  deepStrictEqual(server, listened)
})

test('createServerListener - should override the host only when the port is dynamic', async t => {
  const port = await getPort()
  const server = createHttpServer(t)

  const listener = createServerListener(0, '0.0.0.0')
  await listen(server, { host: '127.0.0.1', port })

  await listener
  ok(server.address().host !== '127.0.0.1')
  deepStrictEqual(server.address().port, port)
})

test('createServerListener - should override the port with fixed value', async t => {
  const port = await getPort()
  const server = createHttpServer(t)

  updateGlobals({
    isEntrypoint: true,
    events: { emitAndNotify () {} }
  })
  t.after(() => {
    updateGlobals({ isEntrypoint: undefined, events: undefined })
  })

  const listener = createServerListener(port)
  await listen(server, { host: '127.0.0.1', port: 100 })

  await listener
  deepStrictEqual(server.address().port, port)
})

test('createServerListener - should not override a fixed port for non-entrypoints', async t => {
  const port = await getPort()
  const originalPort = await getPort()
  const server = createHttpServer(t)

  updateGlobals({
    isEntrypoint: false,
    events: { emitAndNotify () {} }
  })
  t.after(() => {
    updateGlobals({ isEntrypoint: undefined, events: undefined })
  })

  const listener = createServerListener(port)
  await listen(server, { host: '127.0.0.1', port: originalPort })

  await listener
  deepStrictEqual(server.address().port, originalPort)
})

test('createServerListener - should not override the port', async t => {
  const port = await getPort()
  const server = createHttpServer(t)

  const listener = createServerListener(false)
  await listen(server, { host: '127.0.0.1', port })

  await listener
  deepStrictEqual(server.address().port, port)
})

test('createServerListener - handle errors', async t => {
  const server = createHttpServer(t)

  const listener = createServerListener()
  server.listen({ path: '/invalid/path' }).on('error', () => {})

  await rejects(() => listener, /EACCES/)
})

// Vite 8 and later look for a free port by opening and closing throwaway TCP servers before
// binding the dev server. Those probes must not be returned in place of the application server.
test('createServerListener - should ignore port probes and keep applying the server options', async t => {
  const backlog = 123
  const server = createHttpServer(t)

  const intercepted = []
  updateGlobals({ events: { emitAndNotify: (_, options) => intercepted.push(options) } })
  t.after(() => updateGlobals({ events: undefined }))

  const listener = createServerListener(true, false, { backlog })

  const probe = createNetServer()
  await listen(probe, { host: '127.0.0.1', port: 0 })
  const probePort = probe.address().port
  await new Promise(resolve => probe.close(resolve))

  await listen(server, { host: '127.0.0.1', port: 0 })

  const listened = await listener
  deepStrictEqual(listened, server)
  ok(listened.address().port !== probePort)

  // The options of the real server are still intercepted, not only those of the probe
  deepStrictEqual(intercepted.length, 2)
  ok(intercepted.every(options => options.backlog === backlog))
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

test('createServerListener - is cancelable', async t => {
  const listener = createServerListener()
  listener.cancel()
  deepStrictEqual(await listener, null)
})

test('createServerListener - should return the first spawned process', async t => {
  const listener = createChildProcessListener()

  const subprocess = spawn('node', ['-e', 'Date.now()'])

  const listened = await listener
  deepStrictEqual(subprocess, listened)
})

test('createChildProcessListener - is cancelable', async t => {
  const listener = createChildProcessListener()
  listener.cancel()
  deepStrictEqual(await listener, null)
})
