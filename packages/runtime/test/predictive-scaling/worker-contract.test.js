import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { test } from 'node:test'
import { setImmediate } from 'node:timers/promises'
import { PredictiveScalingAlgorithm } from '../../lib/predictive-scaling.js'
import { PredictiveWorkersScaler } from '../../lib/predictive-worker-scaler.js'
import { kWorkerStartTime, kWorkerStatus } from '../../lib/worker/symbols.js'

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
  setCount(workerConfig.static)
  runtime.getWorkers = async () => workers
  runtime.updateApplicationsResources = async changes => {
    updates.push(...changes)
    for (const change of changes) setCount(change.workers)
    return changes.map(change => ({ application: change.application, workers: { success: true, new: change.workers } }))
  }
  const addWorker = t.mock.method(PredictiveScalingAlgorithm.prototype, 'addWorker')
  const process = t.mock.method(PredictiveScalingAlgorithm.prototype, 'process', () => null)
  const syncWorkersCount = t.mock.method(PredictiveScalingAlgorithm.prototype, 'syncWorkersCount')
  const scaler = new PredictiveWorkersScaler(runtime, {
    total: 8, maximum: 8, maxMemory: 1, processIntervalMs: 1000, ...runtimeConfig
  })
  t.after(() => scaler.stop())
  await scaler.add({ id: 'app', workers: workerConfig })
  await scaler.start()
  const algorithm = addWorker.mock.calls[0].this
  async function tick () {
    t.mock.timers.tick(1000)
    for (let i = 0; i < 10; i++) await setImmediate()
  }
  return { runtime, updates, algorithm, process, syncWorkersCount, setCount, tick }
}

for (const { name, workers, total, expected, update } of [
  { name: 'dynamic mode ignores static when minimum is one', workers: { dynamic: true, static: 4, minimum: 1 }, expected: 1, update: 1 },
  { name: 'minimum above startup count', workers: { dynamic: true, static: 1, minimum: 3 }, expected: 3, update: 3 },
  { name: 'dynamic mode ignores static when minimum is above one', workers: { dynamic: true, static: 5, minimum: 3 }, expected: 3, update: 3 },
  { name: 'minimum above total', workers: { dynamic: true, static: 1, minimum: 3 }, total: 1, expected: 3, update: 3 },
  { name: 'fixed count ignores dynamic bounds', workers: { dynamic: false, static: 4, minimum: 2, maximum: 3 }, expected: 4 }
]) {
  test(`provisions the count selected by the worker mode: ${name}`, async t => {
    const { updates, algorithm } = await setup(t, workers, { total: total ?? 8 })
    assert.deepEqual(updates, update ? [{ application: 'app', workers: update }] : [])
    assert.equal(algorithm.targetCount, expected)
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
  { actual: 0, minimum: 3, maximum: 6, expected: 3 },
  { actual: 1, minimum: 3, maximum: 6, expected: 3 },
  { actual: 7, minimum: 1, maximum: 3, expected: 3 }
]) {
  for (const recommendation of [null, 1, 5]) {
    test(`corrects ${actual} workers to ${expected} with recommendation ${recommendation}`, async t => {
      const { updates, algorithm, process, syncWorkersCount, setCount, tick } = await setup(t, {
        dynamic: true, static: minimum, minimum, maximum
      }, { total: 1, maxScaleUpStep: 1 })
      // No heap samples and no spare memory or worker budget are available.
      process.mock.mockImplementation(() => recommendation)
      setCount(actual)
      await tick()
      assert.deepEqual(updates, [{ application: 'app', workers: expected }])
      assert.deepEqual(syncWorkersCount.mock.calls.map(call => call.arguments), [[expected]])
      assert.equal(algorithm.targetCount, expected)
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
  assert.deepEqual(syncWorkersCount.mock.calls.map(call => call.arguments), [
    [3],
    [3]
  ])

  setCount(3)
  await tick()
  setCount(1)
  await tick()
  assert.deepEqual(syncWorkersCount.mock.calls.map(call => call.arguments), [
    [3],
    [3],
    [3]
  ])
})
