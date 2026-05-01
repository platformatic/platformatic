import assert from 'node:assert'
import { test } from 'node:test'
import Ajv from 'ajv'
import { workers } from '../lib/schema.js'

function validate (config) {
  const ajv = new Ajv({ useDefaults: true, coerceTypes: true, allErrors: true, strict: false })
  const schema = { type: 'object', properties: { workers } }
  const v = ajv.compile(schema)
  const valid = v(config)
  assert.ok(valid, `Validation failed: ${JSON.stringify(v.errors)}`)
  return config
}

test('v2 workers config validates correctly', () => {
  const config = validate({ workers: { version: 'v2', dynamic: true } })
  assert.strictEqual(config.workers.version, 'v2')
  assert.strictEqual(config.workers.dynamic, true)
})

test('v2 workers config accepts all v2 properties', () => {
  const config = validate({
    workers: {
      version: 'v2',
      dynamic: true,
      eluThreshold: 0.9,
      processIntervalMs: 5000,
      scaleUpMargin: 0.05,
      scaleDownMargin: 0.4,
      redistributionMs: 20000,
      alphaUp: 0.3,
      alphaDown: 0.2,
      betaUp: 0.3,
      betaDown: 0.2,
      cooldowns: {
        scaleUpAfterScaleUpMs: 1000,
        scaleUpAfterScaleDownMs: 2000,
        scaleDownAfterScaleUpMs: 10000,
        scaleDownAfterScaleDownMs: 8000
      }
    }
  })

  assert.strictEqual(config.workers.eluThreshold, 0.9)
  assert.strictEqual(config.workers.processIntervalMs, 5000)
  assert.strictEqual(config.workers.cooldowns.scaleUpAfterScaleUpMs, 1000)
})

test('v2 workers config rejects invalid values', () => {
  const ajv = new Ajv({ useDefaults: true, coerceTypes: true, allErrors: true, strict: false })
  const schema = { type: 'object', properties: { workers } }
  const v = ajv.compile(schema)

  assert.ok(!v({ workers: { version: 'v2', eluThreshold: 2 } }), 'eluThreshold > 1 should fail')
  assert.ok(!v({ workers: { version: 'v2', alphaUp: -1 } }), 'alphaUp < 0 should fail')
})

test('v1 workers config does not include v2 properties', () => {
  const config = validate({ workers: { dynamic: true } })
  assert.strictEqual(config.workers.eluThreshold, undefined)
  assert.strictEqual(config.workers.processIntervalMs, undefined)
  assert.strictEqual(config.workers.cooldowns, undefined)
})

test('v2 config rejects v1 properties', () => {
  const ajv = new Ajv({ useDefaults: true, coerceTypes: true, allErrors: true, strict: false })
  const v = ajv.compile({ type: 'object', properties: { workers } })

  assert.ok(!v({ workers: { version: 'v2', cooldown: 5000 } }))
  assert.ok(!v({ workers: { version: 'v2', scaleUpELU: 0.8 } }))
})

test('v1 config rejects v2 properties', () => {
  const ajv = new Ajv({ useDefaults: true, coerceTypes: true, allErrors: true, strict: false })
  const v = ajv.compile({ type: 'object', properties: { workers } })

  assert.ok(!v({ workers: { version: 'v1', eluThreshold: 0.8 } }))
  assert.ok(!v({ workers: { dynamic: true, processIntervalMs: 5000 } }))
})

test('rejects unknown properties', () => {
  const ajv = new Ajv({ useDefaults: true, coerceTypes: true, allErrors: true, strict: false })
  const v = ajv.compile({ type: 'object', properties: { workers } })

  assert.ok(!v({ workers: { version: 'v2', fooBar: 123 } }))
  assert.ok(!v({ workers: { fooBar: 123 } }))
})
