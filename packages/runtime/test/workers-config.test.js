import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadConfiguration } from '../index.js'
import { finalizeApplication } from '../lib/config.js'

function load (workers, applicationWorkers, extra = {}) {
  return loadConfiguration(import.meta.dirname, {
    watch: false,
    workers,
    applications: [{ id: 'app', url: 'https://example.com/app', workers: applicationWorkers }],
    ...extra
  })
}

function isSchemaError (error) {
  return error.code === 'PLT_INVALID_ROOT_CONFIGURATION'
}

for (const [key, value] of Object.entries({ version: 'v1', static: 4, cooldown: 5000, gracePeriod: 1000, scaleUpELU: 0.8, scaleDownELU: 0.2 })) {
  test(`rejects removed workers.${key} at runtime and application levels`, async () => {
    await assert.rejects(load({ dynamic: true, [key]: value }), isSchemaError)
    await assert.rejects(load({ dynamic: true }, { [key]: value }), isSchemaError)
  })
}

test('rejects both former versions and deprecated verticalScaler configuration', async () => {
  await assert.rejects(load({ version: 'v2', dynamic: true }), isSchemaError)
  await assert.rejects(load(undefined, undefined, { verticalScaler: { enabled: true } }), isSchemaError)
})

for (const option of ['total', 'maxMemory', 'processIntervalMs', 'maxScaleUpStep']) {
  test(`rejects runtime-only ${option} on applications`, async () => {
    await assert.rejects(load({ dynamic: true }, { [option]: 10 }), isSchemaError)
  })
}

test('dynamic applications start at their effective minimum', async () => {
  for (const minimum of [undefined, 3]) {
    const config = await load({ dynamic: true, minimum, total: 4 })
    assert.equal(config.workers.static, minimum ?? 1)
    assert.equal(config.applications[0].workers.static, minimum ?? 1)
    assert.equal(config.workers.version, undefined)
  }
  const config = await load({ dynamic: true, minimum: 3, total: 4 }, { minimum: 2 })
  assert.equal(config.workers.static, 3)
  assert.equal(config.applications[0].workers.static, 2)
})

test('normalizes inverted minimum and maximum before choosing the initial count', async () => {
  const config = await load({ dynamic: true, minimum: 4, maximum: 2, total: 4 })
  assert.equal(config.workers.minimum, 2)
  assert.equal(config.workers.maximum, 2)
  assert.equal(config.applications[0].workers.static, 2)
})

test('numeric counts disable dynamic scaling even when inherited', async () => {
  const config = await load({ dynamic: true, minimum: 2, total: 4 }, 4)
  assert.deepEqual(config.applications[0].workers, { static: 4, dynamic: false, minimum: 2, maximum: 4 })
  const fixed = await load(4)
  assert.equal(fixed.applications[0].workers.static, 4)
  assert.equal(fixed.applications[0].workers.dynamic, false)
})

test('dynamic scaling remains opt-in and application overrides are inherited consistently', async () => {
  for (const dynamic of [undefined, false, true]) {
    for (const applicationWorkers of [undefined, {}, 4, '4', { dynamic: false }, { dynamic: true, minimum: 2 }]) {
      const config = await load({ dynamic, minimum: 3, total: 4 }, structuredClone(applicationWorkers))
      const later = finalizeApplication(config, {
        id: 'later', url: 'https://example.com/later', workers: structuredClone(applicationWorkers)
      })
      assert.deepEqual(later.workers, config.applications[0].workers)
    }
  }
})

test('supports per-application predictive tuning and separate health grace periods', async () => {
  const tuning = { eluThreshold: 0.7, heapThresholdMb: 128, alphaUp: 0.3, cooldowns: { scaleDownAfterScaleUpMs: 1000 } }
  const config = await load({ dynamic: true }, tuning, { health: { gracePeriod: 5000 } })
  for (const [key, value] of Object.entries(tuning)) assert.deepEqual(config.applications[0].workers[key], value)
  assert.equal(config.health.gracePeriod, 5000)
})
