import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadConfiguration, schema } from '../index.js'
import { prepareApplication } from '../lib/config.js'

function load (workers, applicationWorkers) {
  return loadConfiguration(import.meta.dirname, {
    $schema: schema.$id,
    watch: false,
    workers,
    applications: [{ id: 'app', url: 'https://example.com/app', workers: applicationWorkers }]
  })
}

function isSchemaError (error) {
  return (error.cause ?? error).code === 'PLT_CONFIGURATION_DOES_NOT_VALIDATE_AGAINST_SCHEMA'
}

test('v2 runtime schema rejects static regardless of dynamic setting', async () => {
  for (const dynamic of [undefined, false, true]) {
    await assert.rejects(load({ version: 'v2', dynamic, static: 4 }), isSchemaError)
  }
})

test('v2 dynamic applications ignore static and use the effective minimum', async () => {
  for (const minimum of [undefined, 2]) {
    for (const version of [undefined, 'v1']) {
      for (const dynamic of [undefined, true]) {
        const config = await load(
          { version: 'v2', dynamic: true, minimum: 3 },
          { version, dynamic, static: 4, minimum }
        )
        assert.equal(config.applications[0].workers.dynamic, true)
        assert.equal(config.applications[0].workers.static, minimum ?? 3)
      }
    }
  }
})

test('v2 dynamic applications start at their effective minimum', async () => {
  for (const minimum of [undefined, 3]) {
    const config = await load({ version: 'v2', dynamic: true, minimum })
    assert.equal(config.workers.static, minimum ?? 1)
    assert.equal(config.applications[0].workers.static, minimum ?? 1)
  }
  const config = await load({ version: 'v2', dynamic: true, minimum: 3 }, { minimum: 2 })
  assert.equal(config.workers.static, 3)
  assert.equal(config.applications[0].workers.static, 2)
})

test('v2 initializes workers after normalizing inverted minimum and maximum', async () => {
  const config = await load({ version: 'v2', dynamic: true, minimum: 4, maximum: 2 })
  assert.equal(config.workers.minimum, 2)
  assert.equal(config.workers.static, 2)
  assert.equal(config.applications[0].workers.static, 2)
})

test('v2 continues to allow fixed application worker counts', async () => {
  for (const workers of [4, { dynamic: false, static: 4 }]) {
    const config = await load({ version: 'v2', dynamic: true, minimum: 2 }, workers)
    assert.equal(config.applications[0].workers.static, 4)
    assert.equal(config.applications[0].workers.dynamic, false)
  }
  const config = await load(4)
  assert.equal(config.workers.static, 4)
  assert.equal(config.applications[0].workers.static, 4)
})

test('v2 does not inherit a static count when an application enables dynamic scaling', async () => {
  const config = await load({ version: 'v2', dynamic: false }, { dynamic: true, minimum: 2 })
  assert.equal(config.applications[0].workers.static, 2)
})

test('v2 applies the same rules to applications added after startup', async () => {
  const config = await load({ version: 'v2', dynamic: true, minimum: 3 })
  const later = () => ({ id: 'later', url: 'https://example.com/later' })
  const app = await prepareApplication(config, { ...later(), workers: { minimum: 2 } }, config.workers)
  assert.equal(app.workers.static, 2)
  const fixed = await prepareApplication(config, {
    ...later(), workers: { dynamic: false, static: 4 }
  }, config.workers)
  assert.equal(fixed.workers.static, 4)
  assert.equal(fixed.workers.dynamic, false)
  const dynamic = await prepareApplication(
    config, { ...later(), workers: { dynamic: true, static: 4 } }, config.workers
  )
  assert.equal(dynamic.workers.static, 3)
  assert.equal(dynamic.workers.dynamic, true)
  const inherited = await prepareApplication(config, {
    ...later(), workers: { static: 4 }
  }, config.workers)
  assert.equal(inherited.workers.static, 3)
  assert.equal(inherited.workers.dynamic, true)
})

test('switching scaler versions preserves static and dynamic modes for every application preparation path', async () => {
  const cases = [
    { workers: undefined, count: 1 },
    { workers: {}, count: 1 },
    { workers: { static: 4 }, count: 4 },
    { workers: 4, dynamic: false, count: 4 },
    { workers: '4', dynamic: false, count: 4 },
    { workers: { dynamic: false, static: 4 }, dynamic: false, count: 4 },
    { workers: { dynamic: true, static: 4, minimum: 2 }, dynamic: true, count: 4 }
  ]

  for (const version of ['v1', 'v2']) {
    for (const dynamic of [undefined, false, true]) {
      for (const scenario of cases) {
        const config = await load({ version, dynamic, minimum: 3 }, structuredClone(scenario.workers))
        const expectedInherited = scenario.dynamic ?? dynamic ?? false
        const context = JSON.stringify({ version, dynamic, workers: scenario.workers })
        assert.equal(config.applications[0].workers.dynamic, expectedInherited, `startup: ${context}`)

        const application = () => ({
          id: 'later', url: 'https://example.com/later', workers: structuredClone(scenario.workers)
        })
        const inherited = await prepareApplication(config, application(), config.workers)
        assert.equal(inherited.workers.dynamic, expectedInherited, `with defaults: ${context}`)

        const independent = await prepareApplication(config, application())
        assert.equal(independent.workers.dynamic, scenario.dynamic ?? false, `without defaults: ${context}`)
        const expectedCount = scenario.dynamic && version === 'v2' ? 2 : scenario.count
        assert.equal(independent.workers.static, expectedCount, `without defaults: ${context}`)
      }
    }
  }
})

test('v1 retains its existing static and dynamic configuration behavior', async () => {
  for (const version of [undefined, 'v1']) {
    const config = await load({ version, dynamic: true, static: 4, minimum: 2 })
    assert.equal(config.workers.static, 4)
    assert.equal(config.applications[0].workers.static, 4)
    const defaults = await load({ version, dynamic: true, minimum: 3 })
    assert.equal(defaults.workers.static, 1)
    assert.equal(defaults.applications[0].workers.static, 1)
    const override = await load({ version, dynamic: true }, { static: 4 })
    assert.equal(override.applications[0].workers.static, 4)
    assert.equal(override.applications[0].workers.dynamic, true)
  }
})

test('application preparation selects the runtime algorithm independently of worker defaults', async () => {
  for (const version of ['v1', 'v2']) {
    const config = await load({ version, dynamic: true, minimum: 3 })
    const conflictingVersion = version === 'v1' ? 'v2' : 'v1'
    for (const defaultWorkers of [
      undefined,
      { dynamic: false, static: 5 },
      { dynamic: false, static: 5, version: conflictingVersion }
    ]) {
      const application = await prepareApplication(config, {
        id: 'later',
        url: 'https://example.com/later',
        workers: { version: conflictingVersion, dynamic: true, static: 4, minimum: 2 }
      }, defaultWorkers)
      assert.equal(application.workers.dynamic, true)
      assert.equal(application.workers.static, version === 'v2' ? 2 : 4)
    }
  }
})
