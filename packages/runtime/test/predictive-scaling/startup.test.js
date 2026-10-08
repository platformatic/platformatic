import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { test } from 'node:test'
import { setImmediate } from 'node:timers/promises'
import { finalizeApplication } from '../../lib/config.js'
import { PredictiveApplicationScaler } from '../../lib/predictive-scaling.js'
import { PredictiveWorkersScaler } from '../../lib/predictive-worker-scaler.js'
import { kWorkerStartTime, kWorkerStatus } from '../../lib/worker/symbols.js'
import { createWorkersConfig } from './helpers.js'

async function setup (t) {
  t.mock.timers.enable({ apis: ['Date', 'setInterval'], now: 10000 })
  const runtime = new EventEmitter()
  runtime.logger = { info () {}, warn () {}, error () {} }
  const workers = {}
  runtime.getWorkers = async () => workers
  const updates = []
  runtime.updateApplicationsResources = async changes => { updates.push(...changes) }
  const workersConfig = await createWorkersConfig({ dynamic: true, minimum: 3, maximum: 5, processIntervalMs: 500 })
  const scaler = new PredictiveWorkersScaler(runtime, workersConfig)
  t.after(() => scaler.stop())

  async function addApplication (id, applicationWorkers) {
    const applicationConfig = finalizeApplication({ workers: workersConfig }, { id, workers: applicationWorkers })
    await scaler.add(applicationConfig)
    return applicationConfig
  }

  function startWorkers (applicationConfig) {
    for (let index = 0; index < applicationConfig.workers.static; index++) {
      workers[`${applicationConfig.id}:${index}`] = {
        application: applicationConfig.id,
        raw: { [kWorkerStatus]: 'started', [kWorkerStartTime]: Date.now() }
      }
      runtime.emit('application:worker:started', { application: applicationConfig.id, worker: index })
    }
  }

  async function tick () {
    t.mock.timers.tick(500)
    for (let i = 0; i < 10; i++) await setImmediate()
  }

  return { runtime, scaler, workers, updates, addApplication, startWorkers, tick }
}

test('initial workers already use the normalized minimum before the scaler starts', async t => {
  const { scaler, updates, addApplication, startWorkers, tick } = await setup(t)
  const applicationConfig = await addApplication('app')
  assert.equal(applicationConfig.workers.static, 3)
  startWorkers(applicationConfig)
  const addWorker = t.mock.method(PredictiveApplicationScaler.prototype, 'addWorker')
  await scaler.start()
  assert.equal(addWorker.mock.callCount(), 3)
  await tick()
  assert.deepEqual(updates, [])
})

test('applications added after scaler startup register their normalized workers through lifecycle events', async t => {
  const { scaler, updates, addApplication, startWorkers, tick } = await setup(t)
  await scaler.start()
  const applicationConfig = await addApplication('later', { minimum: 2 })
  assert.equal(applicationConfig.workers.static, 2)
  const addWorker = t.mock.method(PredictiveApplicationScaler.prototype, 'addWorker')
  startWorkers(applicationConfig)
  assert.deepEqual(addWorker.mock.calls.map(call => call.arguments), [
    ['later:0', 10000], ['later:1', 10000]
  ])
  await tick()
  assert.deepEqual(updates, [])
})

test('startup snapshot includes running lifetimes and waits for workers still starting', async t => {
  const { runtime, scaler, workers, addApplication } = await setup(t)
  await addApplication('app')
  const statuses = ['boot', 'init', 'starting', 'started', 'stopping', 'exited']
  for (const [index, status] of statuses.entries()) {
    const raw = { [kWorkerStatus]: status }
    if (index >= 3) raw[kWorkerStartTime] = 1000
    workers[`app:${index}`] = { application: 'app', raw }
  }
  // A worker can be stopped before its start request completes.
  workers['app:6'] = { application: 'app', raw: { [kWorkerStatus]: 'stopping' } }
  const addWorker = t.mock.method(PredictiveApplicationScaler.prototype, 'addWorker')
  await scaler.start()
  assert.deepEqual(addWorker.mock.calls.map(call => call.arguments), [
    ['app:3', 1000], ['app:4', 1000]
  ])
  for (let index = 0; index < 3; index++) {
    workers[`app:${index}`].raw[kWorkerStatus] = 'started'
    workers[`app:${index}`].raw[kWorkerStartTime] = Date.now()
    runtime.emit('application:worker:started', { application: 'app', worker: index })
  }
  assert.deepEqual(addWorker.mock.calls.slice(2).map(call => call.arguments), [
    ['app:0', 10000], ['app:1', 10000], ['app:2', 10000]
  ])
  runtime.emit('application:worker:health:metrics', {
    application: 'app', id: 'app:5', currentHealth: { elu: 0.9, heapUsed: 100 }
  })
  assert.equal(addWorker.mock.callCount(), 5)
})
