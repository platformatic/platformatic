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
  return { updates, algorithm, process, setCount, tick }
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
