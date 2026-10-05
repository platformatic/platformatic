import assert from 'node:assert/strict'
import { availableParallelism } from 'node:os'
import { test } from 'node:test'
import { finalizeApplication, finalizeConfiguration } from '../lib/config.js'
import { PredictiveWorkersScaler } from '../lib/predictive-worker-scaler.js'

async function normalize (workers, applicationWorkers) {
  return finalizeConfiguration(
    { workers, watch: false },
    [{ id: 'app', url: 'https://example.com/app', workers: applicationWorkers }],
    {},
    false,
    finalizeApplication
  )
}

for (const [name, workers, minimum, maximum, total] of [
  ['defaults', { dynamic: true }, 1, availableParallelism(), availableParallelism()],
  ['explicit total', { dynamic: true, total: 4 }, 1, 4, 4],
  ['maximum above total', { dynamic: true, minimum: 2, maximum: 10, total: 4 }, 2, 4, 4],
  ['minimum above maximum', { dynamic: true, minimum: 5, maximum: 2, total: 4 }, 2, 2, 4],
  ['minimum above total', { dynamic: true, minimum: 5, total: 2 }, 2, 2, 2],
  ['minimum above default total', { dynamic: true, minimum: availableParallelism() + 1 }, availableParallelism(), availableParallelism(), availableParallelism()],
  ['explicit total above parallelism', { dynamic: true, minimum: availableParallelism() + 1, total: availableParallelism() + 2 }, availableParallelism() + 1, availableParallelism() + 2, availableParallelism() + 2]
]) {
  test(`normalizes runtime worker bounds and startup count: ${name}`, async () => {
    const config = await normalize(workers)
    assert.equal(config.workers.total, total)
    for (const effective of [config.workers, config.applications[0].workers]) {
      assert.equal(effective.minimum, minimum)
      assert.equal(effective.maximum, maximum)
      assert.equal(effective.static, minimum)
    }
    assert.equal(config.applications[0].workers.total, undefined)
    const scaler = new PredictiveWorkersScaler({}, config.workers)
    assert.equal(scaler.getConfig().minimum, minimum)
    assert.equal(scaler.getConfig().maximum, maximum)
    assert.equal(scaler.getConfig().total, total)
  })
}

for (const [name, runtimeWorkers, applicationWorkers, minimum, maximum] of [
  ['maximum above total', { dynamic: true, minimum: 1, maximum: 2, total: 4 }, { maximum: 10 }, 1, 4],
  ['minimum above inherited maximum', { dynamic: true, minimum: 1, maximum: 3, total: 4 }, { minimum: 5 }, 3, 3],
  ['maximum below inherited minimum', { dynamic: true, minimum: 4, maximum: 6, total: 6 }, { maximum: 2 }, 2, 2],
  ['inverted explicit bounds', { dynamic: true, total: 4 }, { minimum: 3, maximum: 2 }, 2, 2],
  ['application opts into scaling', { total: 2 }, { dynamic: true, minimum: 4 }, 2, 2]
]) {
  test(`normalizes application worker bounds before startup: ${name}`, async () => {
    const config = await normalize(runtimeWorkers, applicationWorkers)
    const effective = config.applications[0].workers
    assert.equal(effective.minimum, minimum)
    assert.equal(effective.maximum, maximum)
    assert.equal(effective.static, minimum)
    assert.equal(effective.total, undefined)
    const added = finalizeApplication(config, {
      id: 'later', url: 'https://example.com/later', workers: structuredClone(applicationWorkers)
    })
    assert.deepEqual(added.workers, effective)
  })
}

test('fixed application counts stay fixed when inheriting dynamic worker defaults', async () => {
  const config = await normalize({ dynamic: true, total: 2, minimum: 5 }, 4)
  assert.equal(config.applications[0].workers.dynamic, false)
  assert.equal(config.applications[0].workers.static, 4)
})

test('fixed worker bounds use the same normalization as dynamic bounds', async () => {
  const config = await normalize({ dynamic: false, minimum: 5, maximum: 10, total: 2 }, 4)
  for (const workers of [config.workers, config.applications[0].workers]) {
    assert.equal(workers.minimum, 2)
    assert.equal(workers.maximum, 2)
    assert.equal(workers.dynamic, false)
  }
  assert.equal(config.workers.static, 1)
  assert.equal(config.applications[0].workers.static, 4)
})

test('application normalization inherits runtime settings while preserving overrides', async () => {
  const config = await normalize({ dynamic: true, minimum: 4, maximum: 6, total: 6 })
  const application = finalizeApplication(config, {
    id: 'app', url: 'https://example.com/app', workers: { minimum: 2 }
  })
  assert.deepEqual(application.workers, { dynamic: true, minimum: 2, maximum: 6, static: 2 })
})
