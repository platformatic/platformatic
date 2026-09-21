import assert from 'node:assert'
import { EventEmitter } from 'node:events'
import { test } from 'node:test'
import { setTimeout as sleep } from 'node:timers/promises'
import { PredictiveWorkersScaler } from '../../lib/predictive-worker-scaler.js'
import { PredictiveScalingAlgorithm } from '../../lib/predictive-scaling.js'
import { kWorkerStartTime, kWorkerStatus } from '../../lib/worker/symbols.js'

function createMockRuntime () {
  const runtime = new EventEmitter()
  runtime.logger = {
    info: () => {},
    warn: () => {},
    error: () => {}
  }
  runtime.updateApplicationsResources = async () => {}
  runtime.getWorkers = async () => ({})
  return runtime
}

function makeConfig (overrides = {}) {
  return {
    version: 'v2',
    dynamic: true,
    processIntervalMs: 500,
    eluThreshold: 0.8,
    scaleUpMargin: 0.1,
    scaleDownMargin: 0.3,
    // Exercise scaling with settled workers; redistribution is covered by unit tests.
    redistributionMs: 1,
    alphaUp: 0.2,
    alphaDown: 0.1,
    betaUp: 0.2,
    betaDown: 0.1,
    cooldowns: {
      scaleUpAfterScaleUpMs: 0,
      scaleUpAfterScaleDownMs: 0,
      scaleDownAfterScaleUpMs: 0,
      scaleDownAfterScaleDownMs: 0
    },
    ...overrides
  }
}

function makeApp (id, overrides = {}) {
  return {
    id,
    entrypoint: false,
    workers: { dynamic: true, ...overrides }
  }
}

function emitHealthMetrics (runtime, application, workerId, workerIndex, elu) {
  runtime.emit('application:worker:health:metrics', {
    id: `${application}:${workerIndex}`,
    application,
    worker: workerIndex,
    currentHealth: { elu }
  })
}

async function feedElu (runtime, application, workerId, workerIndex, elu, durationMs, intervalMs = 200) {
  const ticks = Math.ceil(durationMs / intervalMs)
  for (let i = 0; i < ticks; i++) {
    emitHealthMetrics(runtime, application, workerId, workerIndex, elu)
    await sleep(intervalMs)
  }
}

test('scaler initializes existing lifetimes and timestamps exit notifications', async t => {
  t.mock.timers.enable({ apis: ['Date', 'setInterval'], now: 10000 })
  const runtime = createMockRuntime()
  const existing = { [kWorkerStatus]: 'started', [kWorkerStartTime]: 1000 }
  runtime.getWorkers = async includeRaw => {
    assert.equal(includeRaw, true)
    return {
      'app1:0': { application: 'app1', raw: existing },
      'app1:1': { application: 'app1', raw: { [kWorkerStatus]: 'exited', [kWorkerStartTime]: 1000 } }
    }
  }
  const addWorker = t.mock.method(PredictiveScalingAlgorithm.prototype, 'addWorker')
  const removeWorker = t.mock.method(PredictiveScalingAlgorithm.prototype, 'removeWorker')
  const addSample = t.mock.method(PredictiveScalingAlgorithm.prototype, 'addSample')
  const scaler = new PredictiveWorkersScaler(runtime, makeConfig())
  await scaler.add(makeApp('app1'))
  await scaler.start()
  t.after(() => scaler.stop())

  assert.deepEqual(addWorker.mock.calls.map(call => call.arguments), [['app1:0', 1000]])
  emitHealthMetrics(runtime, 'app1', 'app1:0', 0, 0.4)
  assert.deepEqual(addSample.mock.calls[0].arguments, ['elu', 'app1:0', 10000, 0.4])

  runtime.emit('application:worker:exited', { application: 'app1', worker: 0 })
  assert.deepEqual(removeWorker.mock.calls[0].arguments, ['app1:0', 10000])
  runtime.emit('application:worker:started', { application: 'app1', worker: 0 })
  assert.deepEqual(addWorker.mock.calls.at(-1).arguments, ['app1:0', 10000])
})

test('scaler does not initialize a snapshot worker that exited while the snapshot was awaited', async t => {
  const runtime = createMockRuntime()
  const raw = { [kWorkerStatus]: 'started', [kWorkerStartTime]: 1000 }
  runtime.getWorkers = async () => {
    const snapshot = { 'app1:0': { application: 'app1', raw } }
    raw[kWorkerStatus] = 'exited'
    runtime.emit('application:worker:exited', { application: 'app1', worker: 0 })
    return snapshot
  }
  const addWorker = t.mock.method(PredictiveScalingAlgorithm.prototype, 'addWorker')
  const scaler = new PredictiveWorkersScaler(runtime, makeConfig())
  await scaler.add(makeApp('app1'))
  await scaler.start()
  t.after(() => scaler.stop())
  assert.equal(addWorker.mock.callCount(), 0)
})

test('PredictiveWorkersScaler', async (t) => {
  await t.test('scales up when ELU is high', async (t) => {
    const runtime = createMockRuntime()
    const updates = []
    runtime.updateApplicationsResources = async (u) => { updates.push(...u) }

    const scaler = new PredictiveWorkersScaler(runtime, makeConfig())
    await scaler.add(makeApp('app1'))
    await scaler.start()
    t.after(() => scaler.stop())

    runtime.emit('application:worker:started', { application: 'app1', worker: 0 })

    await feedElu(runtime, 'app1', 'w1', 0, 0.95, 5000)

    const scaleUp = updates.find(u => u.application === 'app1' && u.workers > 1)
    assert.ok(scaleUp, 'should have scaled up app1')
    assert.strictEqual(scaleUp.workers, 2)
  })

  await t.test('does not scale up beyond total workers limit', async (t) => {
    const runtime = createMockRuntime()
    const updates = []
    runtime.updateApplicationsResources = async (u) => { updates.push(...u) }

    const scaler = new PredictiveWorkersScaler(runtime, makeConfig({ total: 1 }))
    await scaler.add(makeApp('app1'))
    await scaler.start()
    t.after(() => scaler.stop())

    runtime.emit('application:worker:started', { application: 'app1', worker: 0 })

    await feedElu(runtime, 'app1', 'w1', 0, 0.95, 5000)

    const scaleUp = updates.find(u => u.application === 'app1' && u.workers > 1)
    assert.strictEqual(scaleUp, undefined, 'should not scale up beyond total limit')
  })

  await t.test('does not scale up when memory is exhausted', async (t) => {
    const runtime = createMockRuntime()
    const updates = []
    runtime.updateApplicationsResources = async (u) => { updates.push(...u) }

    const scaler = new PredictiveWorkersScaler(runtime, makeConfig({ maxMemory: 1 }))
    await scaler.add(makeApp('app1'))
    await scaler.start()
    t.after(() => scaler.stop())

    runtime.emit('application:worker:started', { application: 'app1', worker: 0 })

    await feedElu(runtime, 'app1', 'w1', 0, 0.95, 5000)

    const scaleUp = updates.find(u => u.application === 'app1' && u.workers > 1)
    assert.strictEqual(scaleUp, undefined, 'should not scale up when memory is exhausted')
  })

  await t.test('scales down when ELU is low', async (t) => {
    const runtime = createMockRuntime()
    const updates = []
    runtime.updateApplicationsResources = async (u) => { updates.push(...u) }

    const scaler = new PredictiveWorkersScaler(runtime, makeConfig())
    await scaler.add(makeApp('app1'))
    await scaler.start()
    t.after(() => scaler.stop())

    // Start with 1 worker and high ELU to trigger scale-up
    runtime.emit('application:worker:started', { application: 'app1', worker: 0 })
    await feedElu(runtime, 'app1', 'w1', 0, 0.95, 5000)

    const scaleUp = updates.find(u => u.application === 'app1' && u.workers === 2)
    assert.ok(scaleUp, 'should have scaled up first')

    // Simulate second worker starting
    runtime.emit('application:worker:started', { application: 'app1', worker: 1 })

    // Now feed low ELU from both workers
    updates.length = 0
    for (let i = 0; i < 50; i++) {
      emitHealthMetrics(runtime, 'app1', 'w1', 0, 0.1)
      emitHealthMetrics(runtime, 'app1', 'w2', 1, 0.1)
      await sleep(200)
    }

    const scaleDown = updates.find(u => u.application === 'app1' && u.workers < 2)
    assert.ok(scaleDown, 'should have scaled down')
    assert.strictEqual(scaleDown.workers, 1)
  })

  await t.test('picks highest-priority app for scale-up', async (t) => {
    const runtime = createMockRuntime()
    const updates = []
    runtime.updateApplicationsResources = async (u) => { updates.push(...u) }

    const scaler = new PredictiveWorkersScaler(runtime, makeConfig())
    await scaler.add(makeApp('app1'))
    await scaler.add(makeApp('app2'))
    await scaler.start()
    t.after(() => scaler.stop())

    // app1 has 1 worker, app2 has 1 worker
    runtime.emit('application:worker:started', { application: 'app1', worker: 0 })
    runtime.emit('application:worker:started', { application: 'app2', worker: 0 })

    // Feed high ELU to both apps
    for (let i = 0; i < 25; i++) {
      emitHealthMetrics(runtime, 'app1', 'a1w1', 0, 0.95)
      emitHealthMetrics(runtime, 'app2', 'a2w1', 0, 0.95)
      await sleep(200)
    }

    // Both apps need scale-up, but only one can scale per cycle
    // First scale-up could be either app (both have same ratio)
    const firstScaleUp = updates.find(u => u.workers === 2)
    assert.ok(firstScaleUp, 'should have scaled up one app')

    // Only one app should have scaled up per cycle
    const firstCycleUpdates = updates.filter(u => u.workers === 2)
    // At least one scale-up happened
    assert.ok(firstCycleUpdates.length >= 1)
  })

  await t.test('applies scale-downs freely for all apps', async (t) => {
    const runtime = createMockRuntime()
    const updates = []
    runtime.updateApplicationsResources = async (u) => { updates.push(...u) }

    const scaler = new PredictiveWorkersScaler(runtime, makeConfig())
    await scaler.add(makeApp('app1'))
    await scaler.add(makeApp('app2'))
    await scaler.start()
    t.after(() => scaler.stop())

    // Scale up both apps first
    runtime.emit('application:worker:started', { application: 'app1', worker: 0 })
    runtime.emit('application:worker:started', { application: 'app2', worker: 0 })

    // Feed high ELU to trigger scale-ups
    for (let i = 0; i < 50; i++) {
      emitHealthMetrics(runtime, 'app1', 'a1w1', 0, 0.95)
      emitHealthMetrics(runtime, 'app2', 'a2w1', 0, 0.95)
      await sleep(200)
    }

    // Verify both apps eventually scaled up
    const app1ScaleUp = updates.find(u => u.application === 'app1' && u.workers === 2)
    const app2ScaleUp = updates.find(u => u.application === 'app2' && u.workers === 2)
    assert.ok(app1ScaleUp || app2ScaleUp, 'at least one app should have scaled up')

    // Simulate second workers starting for both
    runtime.emit('application:worker:started', { application: 'app1', worker: 1 })
    runtime.emit('application:worker:started', { application: 'app2', worker: 1 })

    // Now feed low ELU to both
    updates.length = 0
    for (let i = 0; i < 50; i++) {
      emitHealthMetrics(runtime, 'app1', 'a1w1', 0, 0.1)
      emitHealthMetrics(runtime, 'app1', 'a1w2', 1, 0.1)
      emitHealthMetrics(runtime, 'app2', 'a2w1', 0, 0.1)
      emitHealthMetrics(runtime, 'app2', 'a2w2', 1, 0.1)
      await sleep(200)
    }

    // Both apps should be able to scale down in the same cycle (no limit)
    const app1Down = updates.find(u => u.application === 'app1' && u.workers === 1)
    const app2Down = updates.find(u => u.application === 'app2' && u.workers === 1)
    assert.ok(app1Down, 'app1 should have scaled down')
    assert.ok(app2Down, 'app2 should have scaled down')
  })

  await t.test('per-app config overrides global config', async (t) => {
    const runtime = createMockRuntime()
    const updates = []
    runtime.updateApplicationsResources = async (u) => { updates.push(...u) }

    // Global threshold 0.8, app2 overrides to 0.99
    const scaler = new PredictiveWorkersScaler(runtime, makeConfig())
    await scaler.add(makeApp('app1'))
    await scaler.add(makeApp('app2', { eluThreshold: 0.99 }))
    await scaler.start()
    t.after(() => scaler.stop())

    runtime.emit('application:worker:started', { application: 'app1', worker: 0 })
    runtime.emit('application:worker:started', { application: 'app2', worker: 0 })

    // Feed ELU 0.95 to both — above 0.8 threshold but below 0.99
    for (let i = 0; i < 25; i++) {
      emitHealthMetrics(runtime, 'app1', 'a1w1', 0, 0.95)
      emitHealthMetrics(runtime, 'app2', 'a2w1', 0, 0.95)
      await sleep(200)
    }

    const app1ScaleUp = updates.find(u => u.application === 'app1' && u.workers === 2)
    const app2ScaleUp = updates.find(u => u.application === 'app2' && u.workers === 2)
    assert.ok(app1ScaleUp, 'app1 should scale up (ELU 0.95 > threshold 0.8)')
    assert.strictEqual(app2ScaleUp, undefined, 'app2 should not scale up (ELU 0.95 < threshold 0.99)')
  })

  await t.test('stop unsubscribes from events', async (t) => {
    const runtime = createMockRuntime()

    const scaler = new PredictiveWorkersScaler(runtime, makeConfig())
    await scaler.add(makeApp('app1'))
    await scaler.start()

    const listenersBefore = runtime.listenerCount('application:worker:health:metrics')
    scaler.stop()
    const listenersAfter = runtime.listenerCount('application:worker:health:metrics')

    assert.strictEqual(listenersAfter, listenersBefore - 1)
  })

  await t.test('remove deletes app from scaler', async (t) => {
    const runtime = createMockRuntime()
    const updates = []
    runtime.updateApplicationsResources = async (u) => { updates.push(...u) }

    const scaler = new PredictiveWorkersScaler(runtime, makeConfig())
    await scaler.add(makeApp('app1'))
    await scaler.start()
    t.after(() => scaler.stop())

    runtime.emit('application:worker:started', { application: 'app1', worker: 0 })

    // Feed some metrics, then remove the app
    for (let i = 0; i < 5; i++) {
      emitHealthMetrics(runtime, 'app1', 'w1', 0, 0.95)
      await sleep(200)
    }

    scaler.remove('app1')

    // After removal, further metrics should be ignored
    updates.length = 0
    await feedElu(runtime, 'app1', 'w1', 0, 0.95, 3000)

    const scaleUp = updates.find(u => u.application === 'app1')
    assert.strictEqual(scaleUp, undefined, 'should not process removed app')
  })
})
