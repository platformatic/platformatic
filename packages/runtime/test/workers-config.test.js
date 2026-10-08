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

for (const [key, value] of Object.entries({ version: 'v1', cooldown: 5000, gracePeriod: 1000, scaleUpELU: 0.8, scaleDownELU: 0.2 })) {
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

for (const [option, value] of Object.entries({ redistributionMs: 1000, alphaUp: 0.3, alphaDown: 0.2, betaUp: 0.2, betaDown: 0.1, cooldowns: { scaleUpAfterScaleUpMs: 0 } })) {
  test(`accepts ${option} globally and rejects it on applications`, async () => {
    const config = await load({ dynamic: true, [option]: value })
    if (option === 'cooldowns') {
      assert.equal(config.workers.cooldowns.scaleUpAfterScaleUpMs, 0)
      assert.equal(config.workers.cooldowns.scaleDownAfterScaleUpMs, 30000)
    } else {
      assert.deepEqual(config.workers[option], value)
    }
    await assert.rejects(load({ dynamic: true }, { [option]: value }), isSchemaError)
  })
}

test('dynamic applications start at minimum regardless of static', async () => {
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

test('rejects inverted minimum and maximum', async () => {
  await assert.rejects(load({ dynamic: true, minimum: 4, maximum: 2, total: 4 }), {
    code: 'PLT_RUNTIME_INVALID_ARGUMENT',
    message: 'Invalid argument: "Workers minimum (4) must not exceed maximum (2)"'
  })
})

test('numeric counts disable dynamic scaling even when inherited', async () => {
  const config = await load({ dynamic: true, minimum: 2, total: 4 }, 4)
  assert.deepEqual(config.applications[0].workers, { static: 4, dynamic: false, minimum: 2, eluThreshold: 0.8 })
  const fixed = await load(4)
  assert.equal(fixed.applications[0].workers.static, 4)
  assert.equal(fixed.applications[0].workers.dynamic, false)
})

test('static object counts work at runtime and application levels', async () => {
  const config = await load({ static: 4, total: 8 })
  assert.equal(config.workers.static, 4)
  assert.equal(config.workers.dynamic, false)
  assert.equal(config.applications[0].workers.static, 4)
  assert.equal(config.applications[0].workers.dynamic, false)

  const override = await load({ dynamic: true, minimum: 2, total: 8 }, { static: 4, dynamic: false })
  assert.equal(override.applications[0].workers.static, 4)
  assert.equal(override.applications[0].workers.dynamic, false)
})

test('dynamic scaling remains opt-in and application overrides are inherited consistently', async () => {
  for (const dynamic of [undefined, false, true]) {
    for (const applicationWorkers of [undefined, {}, 4, '4', { static: 4 }, { dynamic: false }, { dynamic: true, minimum: 2 }]) {
      const config = await load({ dynamic, minimum: 3, total: 4 }, structuredClone(applicationWorkers))
      const later = finalizeApplication(config, {
        id: 'later', url: 'https://example.com/later', workers: structuredClone(applicationWorkers)
      })
      assert.deepEqual(later.workers, config.applications[0].workers)
    }
  }
})

test('supports per-application thresholds and separate health grace periods', async () => {
  const thresholds = { eluThreshold: 0.7, heapThresholdMb: 128 }
  const config = await load({ dynamic: true }, thresholds, { health: { gracePeriod: 5000 } })
  for (const [key, value] of Object.entries(thresholds)) assert.deepEqual(config.applications[0].workers[key], value)
  assert.equal(config.health.gracePeriod, 5000)
})
