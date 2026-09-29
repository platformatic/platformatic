import assert from 'node:assert/strict'
import { join } from 'node:path'
import { test } from 'node:test'
import { PredictiveWorkersScaler } from '../lib/predictive-worker-scaler.js'
import { prepareAddedApplications } from '../lib/config.js'
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
  ['object', { dynamic: true, minimum: 2, maximum: 3 }, 2],
  ['inverted bounds', { dynamic: true, minimum: 4, maximum: 3 }, 3]
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
    if (typeof workers === 'number') assert.equal(app.getDynamicWorkersScaler(), undefined)
    else assert.ok(app.getDynamicWorkersScaler() instanceof PredictiveWorkersScaler)
  })
}

test('fixed application counts override inherited scaling', async t => {
  const app = await start(t, { dynamic: true, minimum: 2 }, [{ id: 'service-2', workers: 3 }])
  const service = app.getRuntimeConfig().applications.find(app => app.id === 'service-2')
  assert.equal(service.workers.dynamic, false)
  assert.equal(service.workers.static, 3)
})

test('effective scaler configuration exposes predictive defaults and isolates callers', async t => {
  const app = await start(t, { dynamic: true, maxMemory: 123456, total: 8 })
  const scaler = app.getDynamicWorkersScaler()
  const config = scaler.getConfig()
  assert.equal(config.total, 8)
  assert.equal(config.maxMemory, 123456)
  assert.equal(config.eluThreshold, 0.8)
  assert.equal(config.cooldowns.scaleDownAfterScaleUpMs, 30000)
  assert.equal(config.version, undefined)
  config.cooldowns.scaleDownAfterScaleUpMs = 0
  assert.equal(scaler.getConfig().cooldowns.scaleDownAfterScaleUpMs, 30000)
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

test('standalone applications use the same predictive scaler through the application shorthand', async t => {
  const app = await createRuntime(join(root, '../worker-scaler-service/watt.config.mjs'))
  t.after(() => app.close())
  await app.start()
  const scaler = app.getDynamicWorkersScaler()
  assert.ok(scaler instanceof PredictiveWorkersScaler)
  assert.equal(scaler.getConfig().maximum, 2)
  assert.equal(scaler.getConfig().total, 10)
  assert.equal(scaler.getConfig().version, undefined)
})
