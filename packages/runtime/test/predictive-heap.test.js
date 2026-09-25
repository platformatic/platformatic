import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { registerHooks } from 'node:module'
import { test } from 'node:test'
import { setImmediate } from 'node:timers/promises'
import { PredictiveScalingAlgorithm } from '../lib/predictive-scaling.js'
import { kWorkerStartTime, kWorkerStatus } from '../lib/worker/symbols.js'
import { metricView, scalingWarnings } from '../public/scaler/model.js'

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

function createAlgorithm (heapThreshold) {
  const smoothing = { redistributionMs: 1, alphaUp: 1, alphaDown: 1, betaUp: 0, betaDown: 0 }
  return new PredictiveScalingAlgorithm({
    min: 1,
    max: 10,
    scaleUpMargin: 0.1,
    scaleDownMargin: 0.3,
    cooldowns: {},
    metrics: {
      elu: { ...smoothing, threshold: 0.8 },
      heap: { ...smoothing, threshold: heapThreshold }
    }
  })
}

test('heap without a threshold is processed and displayed without making scaling decisions', t => {
  t.mock.timers.enable({ apis: ['Date'], now: 10000 })
  const algorithm = createAlgorithm()
  algorithm.addWorker('app:0', 1000)
  algorithm.addWorker('app:1', 1000)
  algorithm.setTarget(2)
  for (const value of [100, 10000, 1]) {
    algorithm.addSample('heap', 'app:0', Date.now(), value)
    algorithm.addSample('heap', 'app:1', Date.now(), value)
    assert.equal(algorithm.process(Date.now()), null)
    assert.equal(algorithm.targetCount, 2)
    assert.equal(algorithm.getSnapshot('heap').level, 2 * value)
    assert.equal(algorithm.getMetricStats('heap').count, 2)
    t.mock.timers.tick(1000)
  }
  const snapshot = algorithm.getDiagnostics()
  const view = metricView(snapshot, 'heap', Date.now())
  assert.equal(view.threshold, null)
  assert.ok(view.history.length)
  assert.ok(view.forecast.length)
  assert.ok(snapshot.workers.every(worker => worker.metrics.heap.value === 1))
})

test('observation-only heap does not change ELU decisions', t => {
  t.mock.timers.enable({ apis: ['Date'], now: 10000 })
  const withHeap = createAlgorithm()
  const withoutHeap = createAlgorithm()
  for (const algorithm of [withHeap, withoutHeap]) algorithm.addWorker('app:0', 1000)
  for (const elu of [0.95, 0.1, 0.99]) {
    for (const algorithm of [withHeap, withoutHeap]) algorithm.addSample('elu', 'app:0', Date.now(), elu)
    withHeap.addSample('heap', 'app:0', Date.now(), 100000)
    const target = withHeap.process(Date.now())
    assert.equal(target, withoutHeap.process(Date.now()))
    for (const algorithm of [withHeap, withoutHeap]) algorithm.setTarget(target)
    t.mock.timers.tick(40000)
  }
})

test('a configured heap threshold still requests scaling', () => {
  const algorithm = createAlgorithm(100)
  algorithm.addWorker('app:0', 1000)
  algorithm.addSample('heap', 'app:0', 10000, 250)
  assert.equal(algorithm.process(10000), 3)
})

test('metric stats expose the current smoothed level and live count independently of the approved target', t => {
  t.mock.timers.enable({ apis: ['Date'], now: 10000 })
  const algorithm = createAlgorithm()
  assert.deepEqual(algorithm.getMetricStats('heap'), { level: null, trend: 0, count: 0 })
  assert.equal(algorithm.getMetricStats('unknown'), null)
  for (const id of ['app:0', 'app:1']) {
    algorithm.addWorker(id, 1000)
    algorithm.addSample('heap', id, 10000, 200)
  }
  algorithm.process(10000)
  algorithm.setTarget(4)
  assert.equal(algorithm.getSnapshot('heap').level, 400)
  assert.deepEqual(algorithm.getMetricStats('heap'), { level: 400, trend: 0, count: 2 })
  algorithm.removeWorker('app:0', 11000)
  algorithm.removeWorker('app:1', 11000)
  assert.equal(algorithm.getMetricStats('heap').count, 0)
})

test('dashboard warns about an absent heap threshold without hiding measurements', () => {
  const selected = {
    id: 'app',
    targetCount: 1,
    liveCount: 1,
    max: 10,
    pending: [],
    metrics: { heap: { threshold: null } }
  }
  const snapshot = { applications: [selected], maxTotalWorkers: 10, memory: { used: 600, limit: 1000 } }
  assert.match(scalingWarnings(snapshot, selected)[0], /heap scaling threshold not configured/)
  selected.metrics.heap.threshold = 200
  assert.deepEqual(scalingWarnings(snapshot, selected), [])
})

async function setup (t, applications, availableMemory, config = {}) {
  t.mock.timers.enable({ apis: ['Date', 'setInterval'], now: 10000 })
  const algorithms = []
  const originalProcess = PredictiveScalingAlgorithm.prototype.process
  t.mock.method(PredictiveScalingAlgorithm.prototype, 'process', function (now) {
    if (!algorithms.includes(this)) {
      const { approvedTarget } = applications[algorithms.length]
      algorithms.push(this)
      if (approvedTarget) this.setTarget(approvedTarget)
    }
    originalProcess.call(this, now)
    return applications[algorithms.indexOf(this)].desiredTarget
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
  const scaler = new PredictiveWorkersScaler(runtime, {
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
  for (const app of applications) {
    await scaler.add({ id: app.id, workers: { dynamic: true, minimum: app.heap.length, static: app.heap.length } })
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

test('pending workers do not dilute heap cost when approving additional workers', async t => {
  const { updates } = await setup(t, [{ id: 'app', heap: [100, 300], approvedTarget: 4, desiredTarget: 8 }], 450)
  assert.deepEqual(updates, [{ application: 'app', workers: 6 }])
})

for (const availableMemory of [-1, 0, 99, 100]) {
  test(`memory admission with ${availableMemory} bytes available for a 100-byte worker`, async t => {
    const { updates } = await setup(t, [{ id: 'app', heap: [100], desiredTarget: 2 }], availableMemory)
    assert.deepEqual(updates, availableMemory === 100 ? [{ application: 'app', workers: 2 }] : [])
  })
}

for (const heap of [undefined, 0, NaN]) {
  test(`an app without positive heap data (${heap}) waits without blocking another app`, async t => {
    const { updates } = await setup(t, [
      { id: 'unknown', heap: [heap], desiredTarget: 4 },
      { id: 'ready', heap: [100], desiredTarget: 2 }
    ], 150)
    assert.deepEqual(updates, [{ application: 'ready', workers: 2 }])
  })
}

for (const config of [{ maxScaleUpStep: 1 }, { total: 2 }]) {
  test(`memory approval still respects ${JSON.stringify(config)}`, async t => {
    const { updates } = await setup(t, [{ id: 'app', heap: [100], desiredTarget: 10 }], 1000, config)
    assert.deepEqual(updates, [{ application: 'app', workers: 2 }])
  })
}
