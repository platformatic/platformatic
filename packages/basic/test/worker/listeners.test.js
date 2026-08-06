import { deepStrictEqual, rejects } from 'node:assert'
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { test } from 'node:test'
import { createChildProcessListener, createServerListener } from '../../lib/worker/listeners.js'

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

test('createServerListener - handle errors', async t => {
  const server = createHttpServer(t)

  const listener = createServerListener()
  server.listen({ path: '/invalid/path' }).on('error', () => {})

  await rejects(() => listener, /EACCES/)
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
