import assert from 'node:assert/strict'
import fastify from 'fastify'
import getPort from 'get-port'
import { join } from 'node:path'
import { test } from 'node:test'
import { setTimeout as sleep } from 'node:timers/promises'
import { request } from 'undici'
import { prepareApplication } from '../lib/config.js'
import { startPrometheusServer } from '../lib/prom-server.js'
import { scalerUi } from '../lib/scaler-ui.js'
import { schema } from '../lib/schema.js'
import { createRuntime } from './helpers.js'

test('UI assets are local, snapshot reads are uncached, and reads do not run the scaler', async t => {
  const app = fastify()
  t.after(() => app.close())
  let reads = 0
  let memoryReads = 0
  const snapshot = { now: 100000, memory: { used: 100, limit: 200 }, applications: [{ id: 'app', targetCount: 3, liveCount: 2, metrics: {} }] }
  const runtime = {
    getDynamicWorkersScaler: () => ({
      getDiagnostics: () => { reads++; return structuredClone(snapshot) },
      getMemoryDiagnostics: async () => { memoryReads++; return snapshot.memory }
    })
  }
  scalerUi(app, { runtime })
  for (const [path, contentType] of [
    ['/scaler/', 'text/html'], ['/scaler/applications', 'text/html'],
    ['/scaler/scaler.js', 'text/javascript'], ['/scaler/charts.js', 'text/javascript'],
    ['/scaler/model.js', 'text/javascript'], ['/scaler/scaler.css', 'text/css'], ['/scaler/inter.ttf', 'font/ttf']
  ]) {
    const result = await app.inject(path)
    assert.equal(result.statusCode, 200, path)
    assert.ok(result.headers['content-type'].startsWith(contentType))
    assert.ok(result.rawPayload.length > 0)
    assert.match(result.headers['content-security-policy'], /default-src 'self'/)
  }
  assert.equal(reads, 0)
  assert.equal(memoryReads, 0)
  const redirect = await app.inject('/scaler')
  assert.equal(redirect.statusCode, 302)
  assert.equal(redirect.headers.location, 'scaler/')
  for (let i = 0; i < 3; i++) {
    const response = await app.inject('/scaler/snapshot')
    assert.equal(response.statusCode, 200)
    assert.equal(response.headers['cache-control'], 'no-store')
    assert.deepEqual(response.json(), snapshot)
  }
  assert.equal(reads, 3)
  assert.equal(memoryReads, 3)
  assert.equal((await app.inject('/scaler/unknown.js')).statusCode, 404)
  assert.equal((await app.inject({ method: 'POST', url: '/scaler/snapshot' })).statusCode, 404)
  runtime.getDynamicWorkersScaler = () => undefined
  assert.equal((await app.inject('/scaler/snapshot')).statusCode, 503)
})

test('metrics server protects every scaler route with its configured authentication', async t => {
  const logger = fastify().log
  const server = await startPrometheusServer({
    logger,
    getDynamicWorkersScaler: () => ({ getDiagnostics: () => ({ applications: [] }), getMemoryDiagnostics: async () => null })
  }, { hostname: '127.0.0.1', port: 0, auth: { username: 'debug', password: 'secret' } }, false)
  t.after(() => server.close())
  for (const url of ['/scaler', '/scaler/', '/scaler/applications', '/scaler/snapshot', '/scaler/scaler.js', '/scaler/charts.js', '/scaler/model.js', '/scaler/scaler.css', '/scaler/inter.ttf']) {
    assert.equal((await server.inject(url)).statusCode, 401, url)
    const response = await server.inject({ url, headers: { authorization: `Basic ${Buffer.from('debug:secret').toString('base64')}` } })
    assert.equal(response.statusCode, url === '/scaler' ? 302 : 200, url)
  }
})

test('API bounds display history while preserving unbounded forecast inputs', async t => {
  const state = {
    applications: [{
      id: 'app',
      metrics: {
        elu: { level: 3, trend: 0.1, history: [{ timestamp: 1000, value: -0.2 }, { timestamp: 2000, value: 1.5 }] },
        heap: { level: 300e6, trend: 10e6, history: [{ timestamp: 1000, value: -1 }, { timestamp: 2000, value: 300e6 }] }
      }
    }]
  }
  const app = fastify()
  t.after(() => app.close())
  scalerUi(app, { runtime: { getDynamicWorkersScaler: () => ({ getDiagnostics: () => structuredClone(state), getMemoryDiagnostics: async () => null }) } })
  const response = await app.inject('/scaler/snapshot')
  assert.equal(response.statusCode, 200)
  const metrics = response.json().applications[0].metrics
  assert.deepEqual(metrics.elu.history.map(point => point.value), [0, 1])
  assert.deepEqual(metrics.heap.history.map(point => point.value), [0, 300e6])
  assert.equal(metrics.elu.level, 3)
  assert.equal(metrics.elu.trend, 0.1)
  assert.equal(state.applications[0].metrics.elu.history[1].value, 1.5)
})

test('v1 and fixed-worker runtimes do not register diagnostic pages', async t => {
  for (const scaler of [undefined, {}]) {
    const server = await startPrometheusServer({ logger: fastify().log, getDynamicWorkersScaler: () => scaler }, { hostname: '127.0.0.1', port: 0 }, false)
    t.after(() => server.close())
    assert.equal((await server.inject('/scaler/')).statusCode, 404)
    assert.equal((await server.inject('/scaler/snapshot')).statusCode, 404)
  }
})

test('a running v2 runtime serves its actual workers and retained metrics', async t => {
  const port = await getPort()
  const runtime = await createRuntime(join(import.meta.dirname, '../fixtures/prom-server'), {
    $schema: schema.$id,
    entrypoint: 'main',
    watch: false,
    autoload: { path: './services' },
    applications: [{ id: 'service-1', path: './services/service-1', workers: { minimum: 3, maximum: 3 } }],
    server: { hostname: '127.0.0.1', port: 0 },
    metrics: { hostname: '127.0.0.1', port },
    workers: { dynamic: true, version: 'v2', minimum: 1, maximum: 1, processIntervalMs: 1000, heapThresholdMb: 128 }
  })
  t.after(() => runtime.close())
  await runtime.start()
  const origin = `http://127.0.0.1:${port}`
  const html = await request(`${origin}/scaler/`)
  assert.equal(html.statusCode, 200)
  assert.match(await html.body.text(), /APPLICATIONS/)
  let snapshot
  for (let i = 0; i < 50; i++) {
    const response = await request(`${origin}/scaler/snapshot`)
    assert.equal(response.statusCode, 200)
    snapshot = await response.body.json()
    if (snapshot.applications[0]?.metrics.elu.history.length) break
    await sleep(100)
  }
  const application = snapshot.applications.find(app => app.id === 'main')
  assert.ok(Number.isFinite(snapshot.memory.used))
  assert.ok(snapshot.memory.limit > 0)
  assert.ok(application)
  assert.equal(application.targetCount, 1)
  assert.equal(application.liveCount, 1)
  assert.equal(application.workers.length, 1)
  assert.ok(application.metrics.elu.history.length)
  assert.ok(Number.isFinite(application.workers[0].metrics.heap.value))
  assert.equal(application.metrics.heap.threshold, 128 * 1024 * 1024)
  const initial = snapshot.applications.find(app => app.id === 'service-1')
  assert.equal(initial.targetCount, 3)
  assert.equal(initial.liveCount, 3)

  const config = runtime.getRuntimeConfig(true)
  const later = await prepareApplication(config, {
    id: 'later',
    path: join(import.meta.dirname, '../fixtures/prom-server/services/service-1'),
    config: 'platformatic.json',
    workers: { static: 4, minimum: 2, maximum: 2 }
  }, config.workers)
  const fixed = await prepareApplication(config, {
    id: 'fixed',
    path: join(import.meta.dirname, '../fixtures/prom-server/services/service-1'),
    config: 'platformatic.json',
    workers: { dynamic: false, static: 2 }
  }, config.workers)
  await runtime.addApplications([later, fixed], true)
  const response = await request(`${origin}/scaler/snapshot`)
  const applications = (await response.body.json()).applications
  const added = applications.find(app => app.id === 'later')
  assert.equal(added.targetCount, 2)
  assert.equal(added.liveCount, 2)
  assert.equal(added.workers.length, 2)
  const fixedApp = applications.find(app => app.id === 'fixed')
  assert.equal(fixedApp.targetCount, 2)
  assert.equal(fixedApp.liveCount, 2)
  assert.equal(fixedApp.min, 2)
  assert.equal(fixedApp.max, 2)
})
