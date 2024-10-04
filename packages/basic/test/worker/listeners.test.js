import { deepStrictEqual, ok, rejects } from 'node:assert'
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
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

test('createServerListener - should override the host and the port', async t => {
  const server = createHttpServer(t)

  const listener = createServerListener(0, '0.0.0.0')
  await listen(server, { host: '127.0.0.1', port: 100 })

  await listener
  ok(server.address().host !== '127.0.0.1')
  ok(server.address().port !== 100)
})

test('createServerListener - should override the port with fixed value', async t => {
  const server = createHttpServer(t)

  const listener = createServerListener(60000)
  await listen(server, { host: '127.0.0.1', port: 100 })

  await listener
  deepStrictEqual(server.address().port, 60000)
})

test('createServerListener - should not override the port', async t => {
  const server = createHttpServer(t)

  const listener = createServerListener(false)
  await listen(server, { host: '127.0.0.1', port: 60000 })

  await listener
  deepStrictEqual(server.address().port, 60000)
})

test('createServerListener - handle errors', async t => {
  const server = createHttpServer(t)

  const listener = createServerListener()
  server.listen({ path: '/invalid/path' }).on('error', () => {})

  await rejects(() => listener, /EACCES/)
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
