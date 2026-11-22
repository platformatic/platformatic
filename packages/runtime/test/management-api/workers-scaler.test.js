import { deepStrictEqual, ok, strictEqual } from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { Client } from 'undici'
import { DIAGNOSTICS_VERSION } from '../../lib/predictive-worker-scaler.js'
import { createRuntime } from '../helpers.js'

const fixturesDir = join(import.meta.dirname, '..', '..', 'fixtures')

function createClient (t, app) {
  const client = new Client(
    { hostname: 'localhost', protocol: 'http:' },
    { socketPath: app.getManagementApiUrl(), keepAliveTimeout: 10, keepAliveMaxTimeout: 10 }
  )
  t.after(() => client.close())
  return client
}

test('should get the workers scaler state', async t => {
  const app = await createRuntime(join(fixturesDir, 'worker-scaler'), {
    watch: false,
    autoload: { path: './services' },
    health: { enabled: false },
    workers: { dynamic: true, minimum: 1, maximum: 2, total: 8 }
  })
  t.after(() => app.close())
  await app.start()

  const { statusCode, body } = await createClient(t, app).request({ method: 'GET', path: '/api/v1/workers/scaler' })
  strictEqual(statusCode, 200)
  const scaler = await body.json()

  strictEqual(scaler.version, DIAGNOSTICS_VERSION)
  strictEqual(scaler.maxTotalWorkers, 8)
  ok(scaler.memoryLimit > 0)
  strictEqual('memory' in scaler, false)
  deepStrictEqual(scaler.applications.map(application => application.id).sort(), ['service-1', 'service-2'])
  for (const application of scaler.applications) {
    strictEqual(application.liveCount, 1)
    strictEqual(application.minimum, 1)
    strictEqual(application.maximum, 2)
    deepStrictEqual(Object.keys(application.metrics), ['elu', 'heap'])
  }
})

test('should get the runtime memory usage, with or without dynamic workers', async t => {
  const app = await createRuntime(join(fixturesDir, 'worker-scaler'), {
    watch: false,
    autoload: { path: './services' },
    health: { enabled: false },
    workers: 1
  })
  t.after(() => app.close())
  await app.start()

  const { statusCode, body } = await createClient(t, app).request({ method: 'GET', path: '/api/v1/memory' })
  strictEqual(statusCode, 200)
  const memory = await body.json()
  deepStrictEqual(Object.keys(memory).sort(), ['scope', 'total', 'used'])
  ok(['host', 'cgroup-v1', 'cgroup-v2'].includes(memory.scope))
  ok(memory.total > 0)
  ok(memory.used > 0)
})

test('should return 404 when dynamic workers are not enabled', async t => {
  const app = await createRuntime(join(fixturesDir, 'worker-scaler'), {
    watch: false,
    autoload: { path: './services' },
    health: { enabled: false },
    workers: 1
  })
  t.after(() => app.close())
  await app.start()

  const { statusCode, body } = await createClient(t, app).request({ method: 'GET', path: '/api/v1/workers/scaler' })
  strictEqual(statusCode, 404)
  strictEqual((await body.json()).message, 'Dynamic workers scaling is not enabled.')
})
