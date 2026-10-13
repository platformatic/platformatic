import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { registerHooks } from 'node:module'
import { test } from 'node:test'
import { setImmediate } from 'node:timers/promises'
import { PredictiveApplicationScaler } from '../lib/predictive-scaling.js'
import { kWorkerStartTime, kWorkerStatus } from '../lib/worker/symbols.js'
import { finalizeApplication } from '../lib/config.js'
import { createWorkersConfig } from './predictive-scaling/helpers.js'

// Keep admission tests independent of host/container memory and concurrent load.
const metricsUrl = new URL('../lib/metrics.js', import.meta.url).href
const hook = registerHooks({
  load (url, context, nextLoad) {
    if (url !== metricsUrl) return nextLoad(url, context)
    return {
      format: 'module',
      shortCircuit: true,
      source: 'export async function getMemoryInfo () { return { scope: "host", used: 600, total: 1000 } }'
    }
  }
})
const { PredictiveWorkersScaler } = await import('../lib/predictive-worker-scaler.js')
hook.deregister()

function createApplicationScaler (heapThreshold) {
  const smoothing = { redistributionMs: 1, alphaUp: 1, alphaDown: 1, betaUp: 0, betaDown: 0 }
  return new PredictiveApplicationScaler({
    minimum: 1,
    maximum: 10,
    cooldowns: {},
    metrics: {
      elu: { ...smoothing, threshold: 0.8 },
      heap: { ...smoothing, threshold: heapThreshold }
    }
  })
}

test('heap without a threshold is processed without making scaling decisions', t => {
  t.mock.timers.enable({ apis: ['Date'], now: 10000 })
  const applicationScaler = createApplicationScaler()
  applicationScaler.addWorker('app:0', 1000)
  applicationScaler.addWorker('app:1', 1000)
  applicationScaler.setTargetCount(2)
  for (const value of [100, 10000, 1]) {
    applicationScaler.addSample('heap', 'app:0', Date.now(), value)
    applicationScaler.addSample('heap', 'app:1', Date.now(), value)
    assert.equal(applicationScaler.process(Date.now()), null)
    assert.equal(applicationScaler.targetCount, 2)
    assert.equal(applicationScaler._getSnapshot('heap').level, 2 * value)
    assert.equal(applicationScaler.getHeapPerWorker(), value)
    t.mock.timers.tick(1000)
  }
})

test('observation-only heap does not change ELU decisions', t => {
  t.mock.timers.enable({ apis: ['Date'], now: 10000 })
  const withHeap = createApplicationScaler()
  const withoutHeap = createApplicationScaler()
  for (const applicationScaler of [withHeap, withoutHeap]) applicationScaler.addWorker('app:0', 1000)
  for (const elu of [0.95, 0.1, 0.99]) {
    for (const applicationScaler of [withHeap, withoutHeap]) applicationScaler.addSample('elu', 'app:0', Date.now(), elu)
    withHeap.addSample('heap', 'app:0', Date.now(), 100000)
    const target = withHeap.process(Date.now())
    assert.equal(target, withoutHeap.process(Date.now()))
    for (const applicationScaler of [withHeap, withoutHeap]) applicationScaler.setTargetCount(target)
    t.mock.timers.tick(40000)
  }
})

test('a configured heap threshold still requests scaling', () => {
  const applicationScaler = createApplicationScaler(100)
  applicationScaler.addWorker('app:0', 1000)
  applicationScaler.addSample('heap', 'app:0', 10000, 250)
  assert.equal(applicationScaler.process(10000), 3)
})

test('heap per worker uses the live count independently of the approved target', t => {
  t.mock.timers.enable({ apis: ['Date'], now: 10000 })
  const applicationScaler = createApplicationScaler()
  assert.equal(applicationScaler.getHeapPerWorker(), null)
  for (const id of ['app:0', 'app:1']) {
    applicationScaler.addWorker(id, 1000)
    applicationScaler.addSample('heap', id, 10000, 200)
  }
  applicationScaler.process(10000)
  applicationScaler.setTargetCount(4)
  assert.equal(applicationScaler._getSnapshot('heap').level, 400)
  assert.equal(applicationScaler.getHeapPerWorker(), 200)
  applicationScaler.removeWorker('app:0', 11000)
  applicationScaler.removeWorker('app:1', 11000)
  assert.equal(applicationScaler.getHeapPerWorker(), null)
})

test('a zero heap measurement produces a positive estimate below one byte', () => {
  const applicationScaler = createApplicationScaler()
  applicationScaler.addWorker('app:0', 1000)
  applicationScaler.addSample('heap', 'app:0', 10000, 0)
  applicationScaler.process(10000)
  const heapPerWorker = applicationScaler.getHeapPerWorker()
  assert.ok(heapPerWorker > 0 && heapPerWorker < 1)
})

async function setup (t, applications, availableMemory, config = {}) {
  t.mock.timers.enable({ apis: ['Date', 'setInterval'], now: 10000 })
  const applicationScalers = []
  const originalProcess = PredictiveApplicationScaler.prototype.process
  t.mock.method(PredictiveApplicationScaler.prototype, 'process', function (now) {
    if (!applicationScalers.includes(this)) {
      const { approvedTarget } = applications[applicationScalers.length]
      applicationScalers.push(this)
      if (approvedTarget) this.setTargetCount(approvedTarget)
    }
    originalProcess.call(this, now)
    return applications[applicationScalers.indexOf(this)].desiredTarget
  })
  const runtime = new EventEmitter()
  runtime.logger = { info () {}, warn () {}, error () {} }
  runtime.getWorkers = async () => Object.fromEntries(applications.flatMap(app => app.heap.map((_, index) => [
    `${app.id}:${index}`,
    { application: app.id, raw: { [kWorkerStatus]: 'started', [kWorkerStartTime]: 1000 } }
  ])))
  const updates = []
  runtime.updateApplicationsResources = async changes => {
    updates.push(...changes)
    return changes.map(({ application, workers }) => ({ application, workers: { new: workers, success: true } }))
  }
  const runtimeWorkersConfig = await createWorkersConfig({
    processIntervalMs: 100,
    total: 30,
    maxScaleUpStep: 10,
    maxMemory: 600 + availableMemory,
    redistributionMs: 1,
    alphaUp: 1,
    alphaDown: 1,
    betaUp: 0,
    betaDown: 0,
    ...config
  })
  const scaler = new PredictiveWorkersScaler(runtime, runtimeWorkersConfig)
  for (const app of applications) {
    await scaler.add(finalizeApplication({ workers: runtimeWorkersConfig }, { id: app.id, workers: { dynamic: true, minimum: app.heap.length, static: app.heap.length } }))
  }
  await scaler.start()
  t.after(() => scaler.stop())
  for (const app of applications) {
    app.heap.forEach((heapUsed, index) => runtime.emit('application:worker:health:metrics', {
      application: app.id, id: `${app.id}:${index}`, currentHealth: { heapUsed }
    }))
  }
  t.mock.timers.tick(100)
  for (let i = 0; i < 5; i++) await setImmediate()
  return { updates, scaler }
}

test('an unaffordable higher-priority app does not block a smaller app', async t => {
  const { updates } = await setup(t, [
    { id: 'large', heap: [200], desiredTarget: 4 },
    { id: 'small', heap: [100], desiredTarget: 2 }
  ], 150)
  assert.deepEqual(updates, [{ application: 'small', workers: 2 }])
})

test('priority is preserved among affordable apps', async t => {
  const { updates } = await setup(t, [
    { id: 'lower', heap: [50], desiredTarget: 2 },
    { id: 'higher', heap: [100], desiredTarget: 4 }
  ], 150)
  assert.deepEqual(updates, [{ application: 'higher', workers: 2 }])
})

test('available memory caps a multi-worker increase using average heap per live worker', async t => {
  const { updates } = await setup(t, [{ id: 'app', heap: [100, 300], desiredTarget: 6 }], 450)
  assert.deepEqual(updates, [{ application: 'app', workers: 4 }])
})

test('an unfulfilled target does not dilute heap cost or add nonexistent workers', async t => {
  const { updates } = await setup(t, [{ id: 'app', heap: [100, 300], approvedTarget: 4, desiredTarget: 8 }], 450)
  assert.deepEqual(updates, [{ application: 'app', workers: 4 }])
})

for (const availableMemory of [-1, 0, 99, 100]) {
  test(`memory admission with ${availableMemory} bytes available for a 100-byte worker`, async t => {
    const { updates } = await setup(t, [{ id: 'app', heap: [100], desiredTarget: 2 }], availableMemory)
    assert.deepEqual(updates, availableMemory === 100 ? [{ application: 'app', workers: 2 }] : [])
  })
}

for (const heap of [undefined, NaN]) {
  test(`an app without heap data (${heap}) waits without blocking another app`, async t => {
    const { updates } = await setup(t, [
      { id: 'unknown', heap: [heap], desiredTarget: 4 },
      { id: 'ready', heap: [100], desiredTarget: 2 }
    ], 150)
    assert.deepEqual(updates, [{ application: 'ready', workers: 2 }])
  })
}

for (const availableMemory of [-1, 0, 1]) {
  test(`zero heap permits scaling only with available memory (${availableMemory})`, async t => {
    const { updates } = await setup(t, [{ id: 'app', heap: [0], desiredTarget: 4 }], availableMemory)
    assert.deepEqual(updates, availableMemory > 0 ? [{ application: 'app', workers: 4 }] : [])
  })
}

for (const config of [{ maxScaleUpStep: 1 }, { total: 2 }]) {
  test(`memory approval still respects ${JSON.stringify(config)}`, async t => {
    const { updates } = await setup(t, [{ id: 'app', heap: [100], desiredTarget: 10 }], 1000, config)
    assert.deepEqual(updates, [{ application: 'app', workers: 2 }])
  })
}
