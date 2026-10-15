import assert from 'node:assert/strict'
import { join } from 'node:path'
import { test } from 'node:test'
import { setTimeout as sleep } from 'node:timers/promises'
import { prepareAddedApplications } from '../lib/config.js'
import { PredictiveApplicationScaler } from '../lib/predictive-scaling.js'
import { createRuntime } from './helpers.js'

const root = join(import.meta.dirname, '../fixtures/worker-scaler')

async function start (t, workers, applications) {
  const app = await createRuntime(root, {
    watch: false,
    autoload: { path: './services' },
    applications: applications?.map(application => ({ path: join(root, 'services', application.id), ...application })),
    health: { enabled: false },
    workers
  })
  t.after(() => app.close())
  await app.start()
  return app
}

for (const [name, workers, count] of [
  ['number', 3, 3],
  ['object', { dynamic: true, minimum: 2, maximum: 3, total: 8 }, 2]
]) {
  test(`applies runtime workers configuration (${name})`, async t => {
    const app = await start(t, workers)
    const config = app.getRuntimeConfig()
    const entrypoint = config.applications.find(app => app.id === 'service-1')
    const service = config.applications.find(app => app.id === 'service-2')
    assert.equal(entrypoint.workers.static, count)
    assert.equal(service.workers.static, count)
    const all = Object.values(await app.getWorkers())
    assert.equal(all.filter(worker => worker.application === 'service-2').length, count)
    assert.equal(config.workers.dynamic, typeof workers === 'object')
  })
}

test('rejects inverted runtime bounds before starting workers', async t => {
  await assert.rejects(start(t, { dynamic: true, minimum: 4, maximum: 3, total: 8 }), {
    code: 'PLT_RUNTIME_INVALID_ARGUMENT',
    message: 'Invalid argument: "Workers minimum (4) must not exceed maximum (3)"'
  })
})

test('fixed application counts override inherited scaling', async t => {
  const app = await start(t, { dynamic: true, minimum: 2, total: 8 }, [{ id: 'service-2', workers: 3 }])
  const service = app.getRuntimeConfig().applications.find(app => app.id === 'service-2')
  assert.equal(service.workers.dynamic, false)
  assert.equal(service.workers.static, 3)
})

test('applications added after startup receive their minimum workers and can be removed', async t => {
  const app = await createRuntime(join(root, 'added/watt.config.mjs'))
  t.after(() => app.close())
  await app.start()
  const config = app.getRuntimeConfig(true)
  const later = await prepareAddedApplications(config, [{
    id: 'later', path: join(root, 'services/service-2'), workers: { minimum: 2 }
  }], app.getApplicationsIds())
  await app.addApplications(later)
  await app.startApplication('later')
  assert.equal(Object.values(await app.getWorkers()).filter(worker => worker.application === 'later').length, 2)
  await app.removeApplications(['later'])
  assert.equal(Object.values(await app.getWorkers()).filter(worker => worker.application === 'later').length, 0)
})

test('applications stopped and started again are still scaled', async t => {
  let scalingEnabled = false
  t.mock.method(PredictiveApplicationScaler.prototype, 'process', () => scalingEnabled ? 2 : null)
  t.mock.method(PredictiveApplicationScaler.prototype, 'getHeapPerWorker', () => 1)

  const app = await start(t, {
    dynamic: true,
    minimum: 1,
    maximum: 2,
    total: 8,
    processIntervalMs: 100,
    cooldowns: { scaleUpAfterScaleUpMs: 0, scaleUpAfterScaleDownMs: 0 }
  }, [{ id: 'service-1', workers: 1 }])
  await app.stopApplication('service-2')
  await app.startApplication('service-2')
  scalingEnabled = true

  // Closing while a scale-up is still starting a worker is a different scenario.
  const countWorkers = async () => Object.values(await app.getWorkers())
    .filter(worker => worker.application === 'service-2' && worker.status === 'started').length
  for (let i = 0; i < 50 && await countWorkers() < 2; i++) await sleep(100)
  assert.equal(await countWorkers(), 2)
})

test('standalone applications preserve worker settings through the application shorthand', async t => {
  const app = await createRuntime(join(root, '../worker-scaler-service/watt.config.mjs'))
  t.after(() => app.close())
  await app.start()
  const { workers } = app.getRuntimeConfig()
  assert.equal(workers.dynamic, true)
  assert.equal(workers.maximum, 2)
  assert.equal(workers.total, 10)
  assert.equal(workers.version, undefined)
})
