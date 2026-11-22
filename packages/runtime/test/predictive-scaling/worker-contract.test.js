import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { test } from 'node:test'
import { setImmediate } from 'node:timers/promises'
import { PredictiveApplicationScaler } from '../../lib/predictive-scaling.js'
import { PredictiveWorkersScaler } from '../../lib/predictive-worker-scaler.js'
import { kWorkerStartTime, kWorkerStatus } from '../../lib/worker/symbols.js'
import { finalizeApplication } from '../../lib/config.js'
import { createWorkersConfig } from './helpers.js'

async function setup (t, workerConfig, runtimeConfig = {}) {
  t.mock.timers.enable({ apis: ['Date', 'setInterval'], now: 100000 })
  const runtime = new EventEmitter()
  runtime.logger = { info () {}, warn () {}, error () {} }
  const workers = {}
  const updates = []
  function setCount (count) {
    for (const id of Object.keys(workers)) delete workers[id]
    for (let index = 0; index < count; index++) {
      workers[`app:${index}`] = {
        application: 'app', raw: { [kWorkerStatus]: 'started', [kWorkerStartTime]: 1000 }
      }
    }
  }
  runtime.getWorkers = async () => workers
  runtime.updateApplicationsResources = async changes => {
    updates.push(...changes)
    for (const change of changes) {
      setCount(change.workers)
      runtime.emit('application:resources:workers:updated', change)
    }
    return changes.map(change => ({ application: change.application, workers: { success: true, new: change.workers } }))
  }
  const addWorker = t.mock.method(PredictiveApplicationScaler.prototype, 'addWorker')
  const process = t.mock.method(PredictiveApplicationScaler.prototype, 'process', () => null)
  const syncWorkersCount = t.mock.method(PredictiveApplicationScaler.prototype, 'syncWorkersCount')
  const runtimeWorkersConfig = await createWorkersConfig({
    total: 8, maximum: 8, maxMemory: 1, processIntervalMs: 1000, ...runtimeConfig
  })
  const applicationConfig = finalizeApplication({ workers: runtimeWorkersConfig }, { id: 'app', workers: workerConfig })
  setCount(applicationConfig.workers.static)
  const scaler = new PredictiveWorkersScaler(runtime, runtimeWorkersConfig)
  t.after(() => scaler.stop())
  await scaler.add(applicationConfig)
  await scaler.start()
  const applicationScaler = addWorker.mock.calls[0]?.this
  async function tick () {
    t.mock.timers.tick(1000)
    for (let i = 0; i < 10; i++) await setImmediate()
  }
  return { runtime, updates, applicationScaler, process, syncWorkersCount, setCount, tick }
}

for (const { name, workers, total, expected } of [
  { name: 'dynamic mode ignores static when minimum is one', workers: { dynamic: true, static: 4, minimum: 1 }, expected: 1 },
  { name: 'minimum above static', workers: { dynamic: true, static: 1, minimum: 3 }, expected: 3 },
  { name: 'dynamic mode ignores static when minimum is above one', workers: { dynamic: true, static: 5, minimum: 3 }, expected: 3 },
  { name: 'minimum above total', workers: { dynamic: true, static: 1, minimum: 3 }, total: 1, expected: 3 },
  { name: 'fixed count ignores dynamic bounds', workers: { dynamic: false, static: 4, minimum: 2, maximum: 3 }, expected: 4 }
]) {
  test(`normalized startup count needs no scaler update: ${name}`, async t => {
    const { updates, applicationScaler, tick } = await setup(t, workers, { total: total ?? 8 })
    await tick()
    assert.deepEqual(updates, [])
    if (workers.dynamic === false) {
      assert.equal(applicationScaler, undefined)
    } else {
      assert.equal(applicationScaler.targetCount, expected)
    }
  })
}

test('does not reduce a valid count merely because total is exceeded', async t => {
  const { updates, setCount, tick } = await setup(t, { dynamic: true, static: 4, minimum: 1, maximum: 8 }, { total: 1 })
  updates.length = 0
  setCount(4)
  await tick()
  assert.deepEqual(updates, [])
})

for (const { actual, minimum, maximum, expected } of [
  { actual: 0, minimum: 3, maximum: 6, expected: [3, 3, 3] },
  { actual: 1, minimum: 3, maximum: 6, expected: [3, 3, 3] },
  { actual: 7, minimum: 1, maximum: 3, expected: [3, 1, 3] }
]) {
  for (const [index, recommendation] of [null, minimum, maximum].entries()) {
    const expectedCount = expected[index]
    test(`corrects ${actual} workers to ${expectedCount} with recommendation ${recommendation}`, async t => {
      const { updates, applicationScaler, process, syncWorkersCount, setCount, tick } = await setup(t, {
        dynamic: true, static: minimum, minimum, maximum
      }, { total: 1, maxScaleUpStep: 1 })
      // No heap samples and no spare memory or worker budget are available.
      process.mock.mockImplementation(() => recommendation)
      setCount(actual)
      await tick()
      assert.deepEqual(updates, [{ application: 'app', workers: expectedCount }])
      assert.deepEqual(syncWorkersCount.mock.calls.map(call => call.arguments), [[expectedCount]])
      assert.equal(applicationScaler.targetCount, expectedCount)
      process.mock.mockImplementation(() => null)
      await tick()
      assert.equal(updates.length, 1)
    })
  }
}

test('retries an out-of-bounds count without predictive scaling bookkeeping', async t => {
  const { runtime, updates, syncWorkersCount, setCount, tick } = await setup(t, {
    dynamic: true, static: 3, minimum: 3, maximum: 6
  })
  setCount(1)
  runtime.updateApplicationsResources = async changes => {
    updates.push(...changes)
    return [{ application: 'app', workers: { success: false, current: 1, new: 3, started: [] } }]
  }
  await tick()
  await tick()
  assert.deepEqual(updates, [
    { application: 'app', workers: 3 },
    { application: 'app', workers: 3 }
  ])
  assert.equal(syncWorkersCount.mock.callCount(), 0)

  setCount(3)
  await tick()
  setCount(1)
  await tick()
  assert.equal(syncWorkersCount.mock.callCount(), 0)
})
