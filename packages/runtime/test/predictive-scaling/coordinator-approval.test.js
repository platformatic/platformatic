import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { test } from 'node:test'
import { setImmediate, setTimeout } from 'node:timers/promises'
import { PredictiveScalingAlgorithm } from '../../lib/predictive-scaling.js'
import { PredictiveWorkersScaler } from '../../lib/predictive-worker-scaler.js'
import { kWorkerStartTime, kWorkerStatus } from '../../lib/worker/symbols.js'

async function waitFor (condition) {
  for (let i = 0; i < 200; i++) {
    if (condition()) {
      await setImmediate()
      return
    }
    await setTimeout(10)
  }
  assert.fail('timed out waiting for coordinator')
}

function success (updates) {
  return updates.map(({ application, workers }) => ({ application, workers: { new: workers, success: true } }))
}

async function setup (t, config = {}, applications = ['app1']) {
  t.mock.timers.enable({ apis: ['Date', 'setInterval'], now: 10000 })
  const algorithms = new Set()
  const process = t.mock.method(PredictiveScalingAlgorithm.prototype, 'process', function () {
    algorithms.add(this)
    return 4
  })
  const setTarget = t.mock.method(PredictiveScalingAlgorithm.prototype, 'setTarget')
  const runtime = new EventEmitter()
  runtime.logger = { info () {}, warn () {}, error () {} }
  const warnings = t.mock.method(runtime.logger, 'warn')
  const errors = t.mock.method(runtime.logger, 'error')
  runtime.getWorkers = async () => Object.fromEntries(applications.map(application => [
    `${application}:0`,
    { application, raw: { [kWorkerStatus]: 'started', [kWorkerStartTime]: 1000 } }
  ]))
  const updates = []
  runtime.updateApplicationsResources = async changes => {
    updates.push(...changes)
    return success(changes)
  }
  const scaler = new PredictiveWorkersScaler(runtime, {
    processIntervalMs: 500,
    total: 64,
    maxMemory: Number.MAX_SAFE_INTEGER,
    ...config
  })
  for (const id of applications) {
    await scaler.add({ id, entrypoint: false, workers: { dynamic: true } })
  }
  await scaler.start()
  t.after(() => scaler.stop())
  return { runtime, updates, algorithms, process, setTarget, warnings, errors }
}

test('only the selected application records the approved single extra worker', async t => {
  const { updates, algorithms, setTarget } = await setup(t, {}, ['app1', 'app2'])
  t.mock.timers.tick(500)
  await waitFor(() => updates.length === 1)
  const [first, second] = algorithms
  assert.deepEqual(updates, [{ application: 'app1', workers: 2 }])
  assert.deepEqual(setTarget.mock.calls.map(call => call.arguments), [[2]])
  assert.equal(first.getSnapshot('elu').targetCount, 2)
  assert.equal(second.getSnapshot('elu').targetCount, 1)
  t.mock.timers.tick(500)
  await waitFor(() => updates.length === 2)
  assert.deepEqual(updates[1], { application: 'app2', workers: 2 })
})

for (const [name, config] of [['worker limit', { total: 1 }], ['memory limit', { maxMemory: 1 }]]) {
  test(`${name} prevents approval bookkeeping`, async t => {
    const { algorithms, setTarget, warnings, updates } = await setup(t, config)
    t.mock.timers.tick(500)
    await waitFor(() => warnings.mock.callCount() === 1)
    assert.equal(setTarget.mock.callCount(), 0)
    assert.equal([...algorithms][0].getSnapshot('elu').targetCount, 1)
    assert.deepEqual(updates, [])
  })
}

for (const failure of ['throw', 'report', 'no report', 'silent failure']) {
  test(`runtime failure (${failure}) leaves pending starts until expiry`, async t => {
    const { runtime, algorithms, updates, process } = await setup(t)
    runtime.updateApplicationsResources = async changes => {
      updates.push(...changes)
      if (failure === 'throw') throw new Error('failed')
      if (failure === 'report') {
        return [{ application: 'app1', workers: { current: 1, new: 2, started: [], success: false } }]
      }
      if (failure === 'silent failure') return success(changes)
    }
    t.mock.timers.tick(500)
    await waitFor(() => updates.length === 1)
    const [algorithm] = algorithms
    assert.equal(algorithm.getSnapshot('elu').targetCount, 2)

    process.mock.restore()
    algorithm.addSample('elu', 'app1:0', 11000, 0.01)
    assert.equal(algorithm.process(11000), 2)
    algorithm.addSample('elu', 'app1:0', 45000, 0.01)
    assert.equal(algorithm.process(45000), 2)
    algorithm.addSample('elu', 'app1:0', 46000, 0.01)
    assert.equal(algorithm.process(46000), 1)
  })
}

test('a worker-start event during the runtime call resolves an already recorded request', async t => {
  const { runtime, algorithms, errors, process } = await setup(t, {
    redistributionMs: 1,
    cooldowns: { scaleDownAfterScaleUpMs: 0 }
  })
  runtime.updateApplicationsResources = async () => {
    assert.equal([...algorithms][0].getSnapshot('elu').targetCount, 2)
    runtime.emit('application:worker:started', { application: 'app1', worker: 1 })
    throw new Error('failure after worker started')
  }
  t.mock.timers.tick(500)
  await waitFor(() => errors.mock.callCount() === 1)
  const [algorithm] = algorithms
  process.mock.restore()
  algorithm.addSample('elu', 'app1:1', 12000, 0.01)
  assert.equal(algorithm.process(12000), 1)
})

test('coordinator runs cannot overlap while applying an approved target', async t => {
  const { runtime, process, setTarget } = await setup(t)
  let finish
  runtime.updateApplicationsResources = changes => new Promise(resolve => {
    finish = () => resolve(success(changes))
  })
  t.mock.timers.tick(500)
  await waitFor(() => finish)
  t.mock.timers.tick(5000)
  await setImmediate()
  assert.equal(process.mock.callCount(), 1)
  assert.equal(setTarget.mock.callCount(), 1)
  finish()
  await setImmediate()
  t.mock.timers.tick(500)
  await waitFor(() => setTarget.mock.callCount() === 2)
  finish()
  await setImmediate()
})
