import { features } from '@platformatic/foundation'
import { deepStrictEqual, match, ok, rejects, strictEqual } from 'node:assert'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { request } from 'undici'
import { createRuntime, readLogs, updateConfigFile } from '../helpers.js'
import { findAvailablePortRange, prepareRuntime } from './helper.js'

const HOST = '127.0.0.1'

// The runtime runs in the same process of the tests, so simulating a platform where reusePort is not available
// (like macOS or Windows) only requires to patch the features detection before creating the runtime.
// Note that the workers are not affected by the patch, so they keep using the real capabilities of the platform.
function setReusePort (t, value) {
  const original = features.node.reusePort
  features.node.reusePort = value

  t.after(() => {
    features.node.reusePort = original
  })
}

function disableReusePort (t) {
  setReusePort(t, false)
}

async function prepareFixedPortRuntime (
  t,
  { workers = 3, server = {}, application = {}, runtime = {}, portRangeSize = 1 } = {}
) {
  const root = await prepareRuntime(t, 'multiple-workers', { node: ['node'] })
  const configFile = resolve(root, './platformatic.json')
  const port = await findAvailablePortRange({ host: HOST, size: portRangeSize })

  await updateConfigFile(resolve(root, 'node/platformatic.json'), contents => {
    contents.server = { ...contents.server, hostname: HOST, port, ...server }
  })

  await updateConfigFile(configFile, contents => {
    contents.autoload = undefined
    contents.services[0] = { ...contents.services[0], workers, ...application }
    Object.assign(contents, runtime)
  })

  const logsPath = resolve(root, 'logs.txt')
  const app = await createRuntime(configFile, null, { isProduction: true, logsPath })

  t.after(async () => {
    await app.close()
  })

  return { app, port, root, logsPath }
}

test('clamps an application with a fixed port to a single worker when reusePort is not available', async t => {
  disableReusePort(t)

  const { app, port, logsPath } = await prepareFixedPortRuntime(t, { workers: 3 })

  const urls = await app.start()
  deepStrictEqual(Object.keys(urls), ['node:0'])
  strictEqual(new URL(urls['node:0']).port, String(port))

  const { workers } = await app.getApplicationResourcesInfo('node')
  strictEqual(workers, 1)

  const res = await request(`http://${HOST}:${port}/hello`)
  strictEqual(res.statusCode, 200)
  deepStrictEqual(await res.body.json(), { from: 'node' })
  strictEqual(res.headers['x-plt-worker-id'], '0')

  const messages = await readLogs(logsPath, 0)
  const warning = messages.find(m => m.msg?.includes('reusePort is not available'))
  ok(warning, 'The warning about the missing reusePort feature should be logged')
  match(warning.msg, /Setting workers to 1 instead of 3/)
  match(warning.msg, /"server\.portAssignment" to "perWorkerIncrement"/)
})

test('disables dynamic scaling of an application with a fixed port when reusePort is not available', async t => {
  disableReusePort(t)

  const { app, logsPath } = await prepareFixedPortRuntime(t, {
    application: { workers: { dynamic: true, minimum: 1, maximum: 3 } },
    runtime: { workers: 1 }
  })

  const urls = await app.start()
  deepStrictEqual(Object.keys(urls), ['node:0'])

  const messages = await readLogs(logsPath, 0)
  const warning = messages.find(m => m.msg?.includes('reusePort is not available'))
  ok(warning, 'The warning about the missing reusePort feature should be logged')
  match(warning.msg, /Disabling dynamic workers scaling/)
})

test('does not clamp an application using per-worker ports when reusePort is not available', async t => {
  disableReusePort(t)

  const { app, port } = await prepareFixedPortRuntime(t, {
    workers: 3,
    portRangeSize: 3,
    server: { portAssignment: 'perWorkerIncrement' }
  })

  const urls = await app.start()
  deepStrictEqual(Object.keys(urls).sort(), ['node:0', 'node:1', 'node:2'])

  for (let i = 0; i < 3; i++) {
    strictEqual(new URL(urls[`node:${i}`]).port, String(port + i))
  }
})

test('does not clamp an application using an ephemeral port when reusePort is not available', async t => {
  disableReusePort(t)

  const { app } = await prepareFixedPortRuntime(t, { workers: 3, server: { port: 0 } })

  const urls = await app.start()
  deepStrictEqual(Object.keys(urls).sort(), ['node:0', 'node:1', 'node:2'])

  const ports = new Set(Object.values(urls).map(url => new URL(url).port))
  strictEqual(ports.size, 3)
})

test('reports a meaningful error when workers of the same application cannot share a port', async t => {
  // Make the runtime believe reusePort is available so that the application is not clamped to a single worker.
  // Disabling reuseTcpPorts then makes the workers really collide on the port, regardless of the platform.
  setReusePort(t, true)
  const { app, port } = await prepareFixedPortRuntime(t, { workers: 3, application: { reuseTcpPorts: false } })

  await rejects(
    () => app.start(),
    error => {
      strictEqual(error.code, 'PLT_RUNTIME_WORKER_EADDR_IN_USE')
      match(error.message, new RegExp(`Port ${port} is already in use by another worker of the application "node"`))
      match(error.message, /"server\.portAssignment" to "perWorkerIncrement"/)
      return true
    }
  )
})
