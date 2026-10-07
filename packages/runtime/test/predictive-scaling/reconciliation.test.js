import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { registerHooks } from 'node:module'
import { test } from 'node:test'
import { setImmediate } from 'node:timers/promises'
import { PredictiveScalingAlgorithm } from '../../lib/predictive-scaling.js'
import { kWorkerStartTime, kWorkerStatus } from '../../lib/worker/symbols.js'

const memoryKey = Symbol.for('scaler-reconciliation-memory')
const metricsUrl = new URL('../../lib/metrics.js', import.meta.url).href
const hook = registerHooks({
  load (url, context, nextLoad) {
    if (url !== metricsUrl) return nextLoad(url, context)
    return {
      format: 'module',
      shortCircuit: true,
      source: 'export async function getMemoryInfo () { return globalThis[Symbol.for("scaler-reconciliation-memory")]() }'
    }
  }
})
const { PredictiveWorkersScaler } = await import('../../lib/predictive-worker-scaler.js')
hook.deregister()

async function setup (t) {
  t.mock.timers.enable({ apis: ['Date', 'setInterval'], now: 100000 })
  globalThis[memoryKey] = async () => ({ scope: 'host', used: 100, total: 10000 })
  const runtime = new EventEmitter()
  runtime.logger = { info () {}, warn () {}, error () {} }
  runtime.getWorkers = async () => ({
    'app:0': { application: 'app', raw: { [kWorkerStatus]: 'started', [kWorkerStartTime]: 1000 } }
  })
  const updates = []
  runtime.updateApplicationsResources = async changes => {
    updates.push(...changes)
    for (const worker of [1, 2]) runtime.emit('application:worker:started', { application: 'app', worker })
    return [{ application: 'app', workers: { success: true, new: 3 } }]
  }
  const scaler = new PredictiveWorkersScaler(runtime, { total: 4, maxMemory: 10000, maxScaleUpStep: 2, processIntervalMs: 1000, redistributionMs: 0 })
  await scaler.add({ id: 'app', workers: { dynamic: true } })
  await scaler.start()
  runtime.emit('application:worker:health:metrics', { application: 'app', id: 'app:0', currentHealth: { heapUsed: 100, elu: 0.1 } })
  let target = 3
  let algorithm
  const original = PredictiveScalingAlgorithm.prototype.process
  t.mock.method(PredictiveScalingAlgorithm.prototype, 'process', function (now) {
    algorithm ??= this
    original.call(this, now)
    return this === algorithm ? target : 2
  })
  async function tick () {
    t.mock.timers.tick(1000)
    for (let i = 0; i < 10; i++) await setImmediate()
  }
  t.after(() => { scaler.stop(); delete globalThis[memoryKey] })
  return { runtime, scaler, updates, tick, setTarget: value => { target = value }, getAlgorithm: () => algorithm }
}

for (const failure of ['throw', 'report', 'partial']) {
  test(`scale-down ${failure} keeps the requested target`, async t => {
    const { runtime, updates, tick, setTarget, getAlgorithm } = await setup(t)
    await tick()
    assert.equal(getAlgorithm().targetCount, 3)
    setTarget(1)
    runtime.updateApplicationsResources = async changes => {
      updates.push(...changes)
      if (failure === 'throw') throw new Error('stop failed')
      if (failure === 'partial') runtime.emit('application:worker:exited', { application: 'app', worker: 2 })
      return [{ application: 'app', workers: { success: false, current: 3, new: 1, stopped: failure === 'partial' ? [2] : [] } }]
    }
    await tick()
    assert.equal(getAlgorithm().targetCount, 1)
    const before = updates.length
    await tick()
    assert.equal(updates.length, before)
    assert.deepEqual(updates.at(-1), { application: 'app', workers: 1 })
  })
}

test('scale-up capacity assumes the requested scale-down succeeds', async t => {
  const { runtime, scaler, tick, setTarget, updates } = await setup(t)
  await tick()
  await scaler.add({ id: 'other', workers: { dynamic: true } })
  runtime.emit('application:worker:started', { application: 'other', worker: 0 })
  runtime.getWorkers = async () => ({
    'app:0': { application: 'app', status: 'started' },
    'app:1': { application: 'app', status: 'started' },
    'app:2': { application: 'app', status: 'started' },
    'other:0': { application: 'other', status: 'started' }
  })
  runtime.emit('application:worker:health:metrics', { application: 'other', id: 'other:0', currentHealth: { heapUsed: 100, elu: 0.95 } })
  setTarget(1)
  updates.length = 0
  const getWorkers = t.mock.method(runtime, 'getWorkers')
  runtime.updateApplicationsResources = async changes => {
    updates.push(...changes)
    return [{ application: 'app', workers: { success: false, current: 3, new: 1, stopped: [] } }]
  }
  await tick()
  assert.deepEqual(updates, [
    { application: 'app', workers: 1 },
    { application: 'other', workers: 2 }
  ])
  assert.equal(getWorkers.mock.callCount(), 1)
})
