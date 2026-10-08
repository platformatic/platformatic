import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { registerHooks } from 'node:module'
import { test } from 'node:test'
import { setImmediate } from 'node:timers/promises'
import { finalizeApplication } from '../../lib/config.js'
import { PredictiveApplicationScaler } from '../../lib/predictive-scaling.js'
import { kWorkerStartTime, kWorkerStatus } from '../../lib/worker/symbols.js'
import { createWorkersConfig } from './helpers.js'

const memoryKey = Symbol.for('scaler-worker-budget-memory')
const metricsUrl = new URL('../../lib/metrics.js', import.meta.url).href
const hook = registerHooks({
  load (url, context, nextLoad) {
    if (url !== metricsUrl) return nextLoad(url, context)
    return {
      format: 'module',
      shortCircuit: true,
      source: 'export async function getMemoryInfo () { return globalThis[Symbol.for("scaler-worker-budget-memory")]() }'
    }
  }
})
const { PredictiveWorkersScaler } = await import('../../lib/predictive-worker-scaler.js')
hook.deregister()

async function setup (t, config = {}) {
  t.mock.timers.enable({ apis: ['Date', 'setInterval'], now: 100000 })
  globalThis[memoryKey] = async () => ({ scope: 'host', used: 100, total: 10000 })
  const runtime = new EventEmitter()
  runtime.logger = { info () {}, warn () {}, error () {} }
  const workers = {}
  function addWorker (application, index, status = 'started') {
    workers[`${application}:${index}`] = {
      application, raw: { [kWorkerStatus]: status, [kWorkerStartTime]: Date.now() - 10000 }
    }
    if (status === 'started') runtime.emit('application:worker:started', { application, worker: index })
  }
  addWorker('idle', 0)
  addWorker('busy', 0)
  runtime.getWorkers = async () => workers
  const updates = []
  runtime.updateApplicationsResources = async changes => {
    updates.push(...changes)
    for (const { application, workers: count } of changes) {
      for (let i = 0; i < count; i++) {
        if (!workers[`${application}:${i}`]) addWorker(application, i)
      }
      runtime.emit('application:resources:workers:updated', { application, workers: count })
    }
    return changes.map(({ application, workers: count }) => ({ application, workers: { success: true, new: count } }))
  }
  const runtimeWorkersConfig = await createWorkersConfig({
    total: 3,
    maximum: 4,
    maxMemory: 10000,
    processIntervalMs: 1000,
    redistributionMs: 0,
    alphaUp: 1,
    alphaDown: 1,
    betaUp: 0,
    betaDown: 0,
    cooldowns: { scaleUpAfterScaleUpMs: 0, scaleDownAfterScaleUpMs: 0, scaleDownAfterScaleDownMs: 0 },
    ...config
  })
  const scaler = new PredictiveWorkersScaler(runtime, runtimeWorkersConfig)
  async function addApplication (application) {
    await scaler.add(finalizeApplication({ workers: runtimeWorkersConfig }, application))
  }
  await addApplication({ id: 'idle', workers: { dynamic: true, static: 1 } })
  await addApplication({ id: 'busy', workers: { dynamic: true, static: 1 } })
  await scaler.start()
  function sample (application, index, elu) {
    runtime.emit('application:worker:health:metrics', {
      application, id: `${application}:${index}`, currentHealth: { elu, heapUsed: 100 }
    })
  }
  async function tick () {
    t.mock.timers.tick(1000)
    for (let i = 0; i < 10; i++) await setImmediate()
  }
  t.after(() => { scaler.stop(); delete globalThis[memoryKey] })
  return { runtime, scaler, addApplication, workers, updates, addWorker, sample, tick }
}

test('an external resource update consumes capacity before predictive processing', async t => {
  const { runtime, updates, sample, tick } = await setup(t)
  await runtime.updateApplicationsResources([{ application: 'idle', workers: 2 }])
  updates.length = 0
  sample('busy', 0, 0.95)
  await tick()
  assert.deepEqual(updates, [])
})

for (const status of ['boot', 'init', 'starting', 'started', 'stopping', 'exited']) {
  test(`worker budget accounts for ${status} workers from the runtime snapshot`, async t => {
    const { updates, addWorker, sample, tick } = await setup(t)
    addWorker('idle', 1, status)
    sample('busy', 0, 0.95)
    await tick()
    assert.deepEqual(updates, status === 'exited' ? [{ application: 'busy', workers: 2 }] : [])
  })
}

test('workers outside the scaler application map still occupy capacity', async t => {
  const { updates, addWorker, sample, tick } = await setup(t)
  addWorker('other', 0)
  sample('busy', 0, 0.95)
  await tick()
  assert.deepEqual(updates, [])
})

test('fixed applications have no predictor and still occupy the worker budget', async t => {
  const { runtime, updates, addApplication, addWorker, sample, tick } = await setup(t)
  await addApplication({ id: 'idle', workers: { dynamic: false, static: 2 } })
  const process = t.mock.method(PredictiveApplicationScaler.prototype, 'process')
  const addWorkerToScaler = t.mock.method(PredictiveApplicationScaler.prototype, 'addWorker')
  const errors = t.mock.method(runtime.logger, 'error')
  addWorker('idle', 1)
  sample('idle', 0, 0.95)
  sample('busy', 0, 0.95)
  await tick()
  assert.equal(process.mock.callCount(), 1)
  assert.equal(addWorkerToScaler.mock.callCount(), 0)
  assert.equal(errors.mock.callCount(), 0)
  assert.deepEqual(updates, [])
})

for (const change of ['remove', 'replace']) {
  test(`uses the application collection after ${change} occurs while reading worker counts`, async t => {
    const { runtime, scaler, workers, updates, addApplication, sample, tick } = await setup(t)
    const errors = t.mock.method(runtime.logger, 'error')
    runtime.getWorkers = async () => {
      scaler.remove('busy')
      if (change === 'replace') {
        await addApplication({ id: 'busy', workers: { dynamic: true } })
      }
      return workers
    }
    sample('busy', 0, 0.95)
    await tick()
    assert.deepEqual(updates, [])
    assert.equal(errors.mock.callCount(), 0)
  })
}

test('a failed scale-up does not reserve workers that were never created', async t => {
  const { runtime, updates, sample, tick } = await setup(t)
  runtime.updateApplicationsResources = async changes => {
    updates.push(...changes)
    return changes.map(({ application, workers }) => ({
      application, workers: { success: false, current: 1, new: workers, started: [] }
    }))
  }
  sample('busy', 0, 0.95)
  await tick()
  assert.deepEqual(updates, [{ application: 'busy', workers: 2 }])
  sample('idle', 0, 0.95)
  sample('busy', 0, 0.95)
  await tick()
  assert.deepEqual(updates, [
    { application: 'busy', workers: 2 },
    { application: 'idle', workers: 2 }
  ])
})

test('scale-up starts from externally added capacity and only records the extra workers', async t => {
  const { runtime, updates, sample, tick } = await setup(t, { total: 6 })
  const syncWorkersCount = t.mock.method(PredictiveApplicationScaler.prototype, 'syncWorkersCount')
  const setTargetCount = t.mock.method(PredictiveApplicationScaler.prototype, 'setTargetCount')
  await runtime.updateApplicationsResources([{ application: 'busy', workers: 2 }])
  assert.deepEqual(syncWorkersCount.mock.calls.map(call => call.arguments), [[2]])
  assert.equal(syncWorkersCount.mock.calls[0].this.targetCount, 2)
  assert.equal(setTargetCount.mock.callCount(), 0)
  updates.length = 0
  runtime.updateApplicationsResources = async changes => { updates.push(...changes) }
  sample('busy', 0, 0.95)
  sample('busy', 1, 0.95)
  await tick()
  assert.deepEqual(updates, [{ application: 'busy', workers: 3 }])
  assert.deepEqual(syncWorkersCount.mock.calls.map(call => call.arguments), [[2]])
  assert.deepEqual(setTargetCount.mock.calls.map(call => call.arguments), [[3]])
})

test('successful worker updates sync approved targets and stop syncing removed applications', async t => {
  const { runtime, scaler } = await setup(t)
  const syncWorkersCount = t.mock.method(PredictiveApplicationScaler.prototype, 'syncWorkersCount')
  await runtime.updateApplicationsResources([{ application: 'busy', workers: 2 }])
  const appScaler = syncWorkersCount.mock.calls[0].this
  appScaler.setTargetCount(3)

  await runtime.updateApplicationsResources([{ application: 'busy', workers: 3 }])
  assert.deepEqual(syncWorkersCount.mock.calls.map(call => call.arguments), [[2], [3]])
  assert.equal(appScaler.targetCount, 3)

  scaler.remove('busy')
  runtime.emit('application:resources:workers:updated', { application: 'busy', workers: 1 })
  assert.equal(appScaler.targetCount, 3)
  assert.equal(syncWorkersCount.mock.callCount(), 2)

  scaler.stop()
  assert.equal(runtime.listenerCount('application:resources:workers:updated'), 0)
  runtime.emit('application:resources:workers:updated', { application: 'idle', workers: 2 })
  assert.equal(syncWorkersCount.mock.callCount(), 2)
})

for (const change of ['remove', 'replace', 'stop']) {
  test(`uses the current scaler after ${change} occurs during the memory check`, { timeout: 5000 }, async t => {
    const { scaler, updates, sample, addApplication } = await setup(t)
    const process = t.mock.method(PredictiveApplicationScaler.prototype, 'process')
    const setTargetCount = t.mock.method(PredictiveApplicationScaler.prototype, 'setTargetCount')
    const getHeapPerWorker = t.mock.method(PredictiveApplicationScaler.prototype, 'getHeapPerWorker', () => 100)
    const memoryRequested = Promise.withResolvers()
    const memoryResponse = Promise.withResolvers()
    globalThis[memoryKey] = () => {
      memoryRequested.resolve()
      return memoryResponse.promise
    }

    sample('busy', 0, 0.95)
    t.mock.timers.tick(1000)
    await memoryRequested.promise

    if (change === 'stop') {
      scaler.stop()
    } else {
      scaler.remove('busy')
      if (change === 'replace') {
        await addApplication({ id: 'busy', workers: { dynamic: true, static: 1 } })
      }
    }

    memoryResponse.resolve({ scope: 'host', used: 100, total: 10000 })
    for (let i = 0; i < 10; i++) await setImmediate()
    if (change === 'replace') {
      assert.deepEqual(updates, [{ application: 'busy', workers: 2 }])
      assert.equal(setTargetCount.mock.callCount(), 1)
      const updatedScaler = setTargetCount.mock.calls[0].this
      assert.ok(process.mock.calls.every(call => call.this !== updatedScaler))
      assert.equal(getHeapPerWorker.mock.calls[0].this, updatedScaler)
      assert.equal(updatedScaler.targetCount, 2)
    } else {
      assert.deepEqual(updates, [])
      assert.equal(setTargetCount.mock.callCount(), 0)
    }
  })
}

test('minimum corrections reserve capacity before ordinary scale-ups', async t => {
  const { updates, sample, tick, addApplication } = await setup(t, { total: 4 })
  await addApplication({ id: 'idle', workers: { dynamic: true, static: 3, minimum: 3 } })
  sample('busy', 0, 0.95)
  await tick()
  assert.deepEqual(updates, [{ application: 'idle', workers: 3 }])
})

test('all applications below minimum are corrected in the same cycle', async t => {
  const { updates, tick, addApplication } = await setup(t, { total: 1, maxMemory: 1 })
  await addApplication({ id: 'idle', workers: { dynamic: true, static: 3, minimum: 3 } })
  await addApplication({ id: 'busy', workers: { dynamic: true, static: 2, minimum: 2 } })
  await tick()
  assert.deepEqual(updates, [
    { application: 'idle', workers: 3 },
    { application: 'busy', workers: 2 }
  ])
})

test('started workers are not counted twice alongside their approved target', async t => {
  const { updates, sample, tick } = await setup(t, { total: 4 })
  sample('busy', 0, 0.95)
  await tick()
  assert.deepEqual(updates, [{ application: 'busy', workers: 2 }])
  sample('busy', 0, 0.95)
  sample('busy', 1, 0.95)
  await tick()
  assert.deepEqual(updates.at(-1), { application: 'busy', workers: 3 })
})

for (const status of ['stopping', 'exited']) {
  test(`a scale-down frees planned capacity while the removed worker is ${status}`, async t => {
    const { runtime, workers, updates, addWorker, sample, tick, addApplication } = await setup(t, { total: 4 })
    sample('busy', 0, 0.95)
    await tick()
    assert.deepEqual(updates, [{ application: 'busy', workers: 2 }])
    await addApplication({ id: 'other', workers: { dynamic: true, static: 1 } })
    addWorker('other', 0)
    sample('other', 0, 0.95)
    sample('busy', 0, 0)
    sample('busy', 1, 0)
    const originalUpdate = runtime.updateApplicationsResources
    runtime.updateApplicationsResources = async changes => {
      if (changes[0].application === 'busy' && changes[0].workers === 1) {
        updates.push(...changes)
        workers['busy:1'].raw[kWorkerStatus] = status
        if (status === 'exited') runtime.emit('application:worker:exited', { application: 'busy', worker: 1 })
        return [{ application: 'busy', workers: { success: true, new: 1 } }]
      }
      return originalUpdate(changes)
    }
    updates.length = 0
    const getWorkers = t.mock.method(runtime, 'getWorkers')
    await tick()
    assert.deepEqual(updates, [
      { application: 'busy', workers: 1 },
      { application: 'other', workers: 2 }
    ])
    assert.equal(getWorkers.mock.callCount(), 1)
  })
}
