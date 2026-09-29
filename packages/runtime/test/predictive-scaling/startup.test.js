import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { test } from 'node:test'
import { setImmediate } from 'node:timers/promises'
import { PredictiveScalingAlgorithm } from '../../lib/predictive-scaling.js'
import { PredictiveWorkersScaler } from '../../lib/predictive-worker-scaler.js'
import { kWorkerStartTime, kWorkerStatus } from '../../lib/worker/symbols.js'

function setup (t, config = {}) {
  t.mock.timers.enable({ apis: ['Date', 'setInterval'], now: 10000 })
  const runtime = new EventEmitter()
  runtime.logger = { info () {}, warn () {}, error () {} }
  runtime.getWorkers = async () => ({
    'app:0': { application: 'app', raw: { [kWorkerStatus]: 'started', [kWorkerStartTime]: 1000 } }
  })
  const updates = []
  runtime.updateApplicationsResources = async changes => {
    updates.push(changes)
    for (const change of changes) {
      for (let i = 1; i < change.workers; i++) {
        runtime.emit('application:worker:started', { application: change.application, worker: i })
      }
    }
  }
  const scaler = new PredictiveWorkersScaler(runtime, { minimum: 3, maximum: 5, processIntervalMs: 500, ...config })
  t.after(() => scaler.stop())
  return { runtime, scaler, updates }
}

function application (id = 'app', workers = {}) {
  return { id, entrypoint: false, workers: { dynamic: true, static: 1, ...workers } }
}

test('start provisions the configured minimum before the first predictive decision', async t => {
  const { scaler, updates } = setup(t)
  const process = t.mock.method(PredictiveScalingAlgorithm.prototype, 'process')
  await scaler.add(application())
  await scaler.applyPendingUpdate('app')
  assert.deepEqual(updates, [])
  await scaler.start()
  assert.deepEqual(updates, [[{ application: 'app', workers: 3 }]])
  assert.equal(process.mock.callCount(), 0)
  const app = scaler.getDiagnostics().applications[0]
  assert.equal(app.targetCount, 3)
  assert.equal(app.liveCount, 3)
  assert.equal(app.workers.length, 3)
  await scaler.applyPendingUpdate('app')
  assert.equal(updates.length, 1)
})

test('later applications wait for their startup hook and share an in-flight minimum update', async t => {
  const { scaler, runtime, updates } = setup(t)
  await scaler.start()
  await scaler.add(application('later', { minimum: 2 }))
  assert.deepEqual(updates, [])
  let finish
  const gate = new Promise(resolve => { finish = resolve })
  runtime.updateApplicationsResources = async changes => {
    updates.push(changes)
    await gate
    runtime.emit('application:worker:started', { application: 'later', worker: 1 })
  }
  runtime.emit('application:worker:started', { application: 'later', worker: 0 })
  const first = scaler.applyPendingUpdate('later')
  const second = scaler.applyPendingUpdate('later')
  await setImmediate()
  assert.deepEqual(updates, [[{ application: 'later', workers: 2 }]])
  const process = t.mock.method(PredictiveScalingAlgorithm.prototype, 'process')
  t.mock.timers.tick(500)
  await setImmediate()
  assert.equal(process.mock.callCount(), 0)
  finish()
  await Promise.all([first, second])
  t.mock.timers.tick(500)
  await setImmediate()
  assert.equal(process.mock.callCount(), 1)
  assert.equal(scaler.getDiagnostics().applications[0].liveCount, 2)
})

test('initial counts already meeting the minimum and fixed workers need no startup update', async t => {
  const { scaler, updates } = setup(t)
  await scaler.add(application('ready', { static: 3 }))
  await scaler.add(application('fixed', { dynamic: false, static: 2 }))
  await scaler.start()
  await scaler.applyPendingUpdate('ready')
  await scaler.applyPendingUpdate('fixed')
  assert.deepEqual(updates, [])
  assert.deepEqual(scaler.getDiagnostics().applications.map(app => app.targetCount), [3, 2])
})

test('removing an application also removes its startup update', async t => {
  const { scaler, updates } = setup(t)
  await scaler.add(application())
  scaler.remove('app')
  await scaler.start()
  await scaler.applyPendingUpdate('app')
  assert.deepEqual(updates, [])
  await scaler.add(application())
  const pending = scaler.applyPendingUpdate('app')
  scaler.remove('app')
  await pending
  assert.deepEqual(updates, [])
})

test('a completed old startup update cannot clear the replacement application update', async t => {
  const { scaler, runtime, updates } = setup(t)
  await scaler.start()
  await scaler.add(application())
  let finish
  runtime.updateApplicationsResources = async changes => {
    updates.push(changes)
    await new Promise(resolve => { finish = resolve })
  }
  const pending = scaler.applyPendingUpdate('app')
  await setImmediate()
  scaler.remove('app')
  await scaler.add(application('app', { minimum: 4 }))
  finish()
  await pending
  const replacement = scaler.applyPendingUpdate('app')
  await setImmediate()
  finish()
  await replacement
  assert.deepEqual(updates, [[{ application: 'app', workers: 3 }], [{ application: 'app', workers: 4 }]])
})

test('a stopped scaler does not provision newly queued applications', async t => {
  const { scaler, updates } = setup(t)
  await scaler.start()
  scaler.stop()
  await scaler.add(application())
  await scaler.applyPendingUpdate('app')
  assert.deepEqual(updates, [])
})
