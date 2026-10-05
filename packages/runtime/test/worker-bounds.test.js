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

// Dynamic startup always uses minimum; valid bounds remain unchanged.
for (const { name, input, expected } of [
  { name: 'defaults', input: undefined, expected: { static: 1, dynamic: false } },
  { name: 'numeric fixed count', input: 4, expected: { static: 4, dynamic: false } },
  { name: 'string fixed count', input: '4', expected: { static: 4, dynamic: false } },
  { name: 'object fixed count', input: { static: 4 }, expected: { static: 4, dynamic: false } },
  { name: 'dynamic defaults', input: { dynamic: true }, expected: { dynamic: true, static: 1 } },
  {
    name: 'dynamic startup ignores static',
    input: { dynamic: true, static: 4, minimum: 2, maximum: 8 },
    expected: { dynamic: true, static: 2, minimum: 2, maximum: 8 }
  },
  {
    name: 'equal bounds',
    input: { dynamic: true, minimum: 2, maximum: 2 },
    expected: { dynamic: true, minimum: 2, maximum: 2, static: 2 }
  },
  {
    name: 'minimum above total',
    input: { dynamic: true, minimum: 5, total: 2 },
    expected: { dynamic: true, minimum: 5, total: 2, static: 5 }
  },
  {
    name: 'maximum above total',
    input: { dynamic: true, maximum: 10, total: 4 },
    expected: { dynamic: true, maximum: 10, total: 4, static: 1 }
  },
  {
    name: 'fixed startup count outside dynamic bounds',
    input: { static: 6, minimum: 2, maximum: 4, total: 2 },
    expected: { static: 6, minimum: 2, maximum: 4, total: 2, dynamic: false }
  }
]) {
  test(`normalizes runtime worker settings: ${name}`, async () => {
    const config = await normalize(structuredClone(input))
    assert.deepEqual(config.workers, { ...expected, total: expected.total ?? availableParallelism() })
    const inherited = { ...expected }
    delete inherited.total
    assert.deepEqual(config.applications[0].workers, inherited)
    const effective = new PredictiveWorkersScaler({}, config.workers).getConfig()
    assert.equal(effective.minimum, expected.minimum ?? 1)
    assert.equal(effective.maximum, expected.maximum ?? expected.total ?? availableParallelism())
    assert.equal(effective.total, expected.total ?? availableParallelism())
  })
}

for (const { name, runtime, application, expected } of [
  {
    name: 'application maximum above total',
    runtime: { dynamic: true, minimum: 1, maximum: 2, total: 4 },
    application: { maximum: 10 },
    expected: { dynamic: true, minimum: 1, maximum: 10, static: 1 }
  },
  {
    name: 'static object preserves inherited dynamic mode',
    runtime: { dynamic: true, minimum: 2, total: 8 },
    application: { static: 4 },
    expected: { dynamic: true, minimum: 2, static: 2 }
  },
  {
    name: 'explicit static mode disables inherited scaling',
    runtime: { dynamic: true, minimum: 2, total: 8 },
    application: { static: 4, dynamic: false },
    expected: { dynamic: false, minimum: 2, static: 4 }
  },
  {
    name: 'numeric count disables inherited scaling',
    runtime: { dynamic: true, minimum: 2, total: 8 },
    application: 4,
    expected: { dynamic: false, minimum: 2, static: 4 }
  },
  {
    name: 'application minimum determines dynamic startup count',
    runtime: { dynamic: true, static: 4, minimum: 1, maximum: 8 },
    application: { minimum: 2 },
    expected: { dynamic: true, minimum: 2, maximum: 8, static: 2 }
  },
  {
    name: 'application dynamic override leaves runtime mode unchanged',
    runtime: { dynamic: false, total: 2 },
    application: { dynamic: true, minimum: 4 },
    expected: { dynamic: true, minimum: 4, static: 4 }
  }
]) {
  test(`normalizes application worker settings: ${name}`, async () => {
    const config = await normalize(structuredClone(runtime), structuredClone(application))
    assert.deepEqual(config.applications[0].workers, expected)
    assert.equal(config.workers.dynamic, runtime.dynamic)
    const added = finalizeApplication(config, { id: 'later', workers: structuredClone(application) })
    assert.deepEqual(added.workers, expected)
  })
}

for (const dynamic of [false, true]) {
  test(`rejects inverted runtime bounds with dynamic=${dynamic}`, async () => {
    const workers = { dynamic, minimum: 5, maximum: 2 }
    await assert.rejects(normalize(workers), {
      code: 'PLT_RUNTIME_INVALID_ARGUMENT',
      message: 'Invalid argument: "Workers minimum (5) must not exceed maximum (2)"'
    })
    assert.equal(workers.minimum, 5)
    assert.equal(workers.maximum, 2)
  })
}

for (const { name, runtime, application, minimum, maximum } of [
  {
    name: 'explicit application bounds',
    runtime: { dynamic: true },
    application: { minimum: 5, maximum: 2 },
    minimum: 5,
    maximum: 2
  },
  {
    name: 'minimum above inherited maximum',
    runtime: { dynamic: true, minimum: 1, maximum: 3 },
    application: { minimum: 5 },
    minimum: 5,
    maximum: 3
  },
  {
    name: 'maximum below inherited minimum',
    runtime: { dynamic: true, minimum: 4, maximum: 6 },
    application: { maximum: 2 },
    minimum: 4,
    maximum: 2
  }
]) {
  test(`rejects invalid application bounds: ${name}`, async () => {
    const error = {
      code: 'PLT_RUNTIME_INVALID_ARGUMENT',
      message: `Invalid argument: "Workers minimum (${minimum}) must not exceed maximum (${maximum})"`
    }
    await assert.rejects(normalize(structuredClone(runtime), structuredClone(application)), error)

    const config = await normalize(structuredClone(runtime))
    const added = { id: 'later', workers: structuredClone(application) }
    assert.throws(() => finalizeApplication(config, added), error)
    assert.equal(added.workers.minimum, minimum)
    assert.equal(added.workers.maximum, maximum)
  })
}
