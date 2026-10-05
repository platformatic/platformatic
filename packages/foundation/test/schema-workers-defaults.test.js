import assert from 'node:assert/strict'
import { test } from 'node:test'
import Ajv from 'ajv'
import { application, runtimeProperties, workers } from '../lib/schema.js'

function validator (schema) {
  return new Ajv({ useDefaults: true, coerceTypes: true, allErrors: true, strict: false }).compile(schema)
}

test('worker schemas accept predictive settings without a version selector', () => {
  const validate = validator(workers)
  assert.ok(validate({ dynamic: true, minimum: 1, maximum: 4, total: 8, eluThreshold: 0.8, heapThresholdMb: 128, processIntervalMs: 1000, maxScaleUpStep: 2, cooldowns: { scaleUpAfterScaleUpMs: 0 } }))
  assert.ok(validate(4))
  assert.ok(validate('{PLT_WORKERS}'))
})

test('worker defaults are applied by normalization, without schema branch side effects', () => {
  const value = { dynamic: true }
  assert.ok(validator(workers)(value))
  assert.deepEqual(value, { dynamic: true })
})

test('runtime and application workers reject legacy settings and unknown keys', () => {
  for (const schema of [workers, application.properties.workers]) {
    const validate = validator(schema)
    for (const value of [{ version: 'v1' }, { version: 'v2' }, { static: 2 }, { cooldown: 0 }, { gracePeriod: 0 }, { scaleUpELU: 0.8 }, { scaleDownELU: 0.2 }, { unknown: true }]) {
      assert.equal(validate(value), false, JSON.stringify(value))
    }
  }
  assert.equal(runtimeProperties.verticalScaler, undefined)
})

test('application workers declare dynamic and reject global-only settings', () => {
  const validate = validator(application.properties.workers)
  assert.ok(validate({ dynamic: false }))
  assert.ok(validate({ dynamic: true, minimum: 2, eluThreshold: 0.7 }))
  for (const key of ['total', 'maxMemory', 'processIntervalMs', 'maxScaleUpStep']) assert.equal(validate({ [key]: 10 }), false)
})

test('validates predictive tuning ranges and cooldown keys', () => {
  const validate = validator(workers)
  for (const value of [{ eluThreshold: 2 }, { alphaUp: -1 }, { cooldowns: { unknown: 0 } }, ...[0, -1, 1.5].map(maxScaleUpStep => ({ maxScaleUpStep }))]) {
    assert.equal(validate(value), false)
  }
})

test('runtime and application worker thresholds must be positive when set', () => {
  for (const schema of [workers, application.properties.workers]) {
    const validate = validator(schema)
    assert.ok(validate({ dynamic: true }))
    for (const key of ['eluThreshold', 'heapThresholdMb']) {
      for (const value of [0, -1]) assert.equal(validate({ [key]: value }), false, `${key}: ${value}`)
      for (const value of [0.0001, 1]) assert.ok(validate({ [key]: value }), `${key}: ${value}`)
    }
    assert.equal(validate({ eluThreshold: 1.0001 }), false)
    assert.ok(validate({ heapThresholdMb: 128 }))
  }
})
