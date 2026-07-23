import { features, safeRemove } from '@platformatic/foundation'
import assert, { deepStrictEqual } from 'node:assert'
import { cp, mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { setTimeout as sleep } from 'node:timers/promises'
import { request } from 'undici'
import { transform } from '../lib/config.js'
import { DynamicWorkersScaler } from '../lib/worker-scaler.js'
import { kWorkerStartTime, kWorkerStatus } from '../lib/worker/symbols.js'
import { createRuntime, updateConfigFile } from './helpers.js'

const fixturesDir = join(import.meta.dirname, '..', 'fixtures')

const configurations = {
  default: 'platformatic.json',
  'worker-scaler': 'platformatic.worker-scaler.json'
}

function countWorkers (workers, applicationId) {
  let count = 0
  for (const worker of Object.values(workers)) {
    if (worker.application === applicationId) count++
  }
  return count
}

async function waitForWorkers (app, applicationId, expectedCount, { timeoutMs = 30000, intervalMs = 250 } = {}) {
  const start = Date.now()
  let workers
  while (Date.now() - start < timeoutMs) {
    workers = await app.getWorkers()
    if (countWorkers(workers, applicationId) === expectedCount) return workers
    await sleep(intervalMs)
  }
  return workers
}

async function driveLoad (entryUrl, signal) {
  while (!signal.aborted) {
    try {
      await request(entryUrl + '/service-2/cpu-intensive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timeout: 500 })
      })
    } catch {
      // Ignore transient errors while the scaler is adding workers.
    }
  }
}

for (const [name, file] of Object.entries(configurations)) {
  test(`should scale an application if elu is higher than treshold (configuration ${name})`, async t => {
    const configFile = join(fixturesDir, 'worker-scaler', file)
    const app = await createRuntime(configFile)
    const entryUrl = await app.start()

    t.after(() => app.close())

    // Drive sustained load instead of a single burst and poll for the new
    // worker instead of sleeping a fixed amount of time: a single burst can
    // be missed by the ELU sampling window on slow CI runners.
    const ac = new AbortController()
    const load = driveLoad(entryUrl, ac.signal)
    t.after(async () => {
      ac.abort()
      await load
    })

    const workers = await waitForWorkers(app, 'service-2', 2)
    assert.strictEqual(countWorkers(workers, 'service-1'), 1)
    assert.strictEqual(countWorkers(workers, 'service-2'), 2)
  })

  test(`should not scale an application when the scaler is the cooldown(configuration ${name})`, async t => {
    const configFile = join(fixturesDir, 'worker-scaler', file)
    const app = await createRuntime(configFile, null, {
      async transform (config, ...args) {
        config = await transform(config, ...args)
        config.verticalScaler = {
          enabled: true,
          maxTotalWorkers: 5,
          gracePeriod: 1
        }
        return config
      }
    })

    const entryUrl = await app.start()

    t.after(() => app.close())

    const ac = new AbortController()
    const load = driveLoad(entryUrl, ac.signal)
    t.after(async () => {
      ac.abort()
      await load
    })

    const workers = await waitForWorkers(app, 'service-2', 2)
    assert.strictEqual(countWorkers(workers, 'service-1'), 1)
    assert.strictEqual(countWorkers(workers, 'service-2'), 2)
  })

  test(`should not scale applications when the elu is lower than treshold (configuration ${name})`, async t => {
    const configFile = join(fixturesDir, 'worker-scaler', file)
    const app = await createRuntime(configFile, null, {
      async transform (config, ...args) {
        config.verticalScaler = {
          enabled: true,
          maxTotalWorkers: 5,
          gracePeriod: 1,
          scaleUpELU: 1
        }
        config = await transform(config, ...args)
        return config
      }
    })

    const entryUrl = await app.start()

    t.after(() => app.close())

    const { statusCode } = await request(entryUrl + '/service-2/cpu-intensive', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ timeout: 1000 })
    })
    assert.strictEqual(statusCode, 200)

    await sleep(10000)

    const workers = await app.getWorkers()

    const service1Workers = []
    const service2Workers = []

    for (const worker of Object.values(workers)) {
      if (worker.application === 'service-1') {
        service1Workers.push(worker)
      }
      if (worker.application === 'service-2') {
        service2Workers.push(worker)
      }
    }

    assert.strictEqual(service1Workers.length, 1)
    assert.strictEqual(service2Workers.length, 1)
  })

  test(`should not scale applications when the worker property is set (configuration ${name})`, async t => {
    const configFile = join(fixturesDir, 'worker-scaler', file)
    const app = await createRuntime(configFile, null, {
      async transform (config, ...args) {
        config = await transform(config, ...args)
        config.workers = { static: 1, dynamic: false }
        return config
      }
    })

    const entryUrl = await app.start()

    t.after(() => app.close())

    const { statusCode } = await request(entryUrl + '/service-2/cpu-intensive', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ timeout: 1000 })
    })
    assert.strictEqual(statusCode, 200)

    await sleep(10000)

    const workers = await app.getWorkers()

    const service1Workers = []
    const service2Workers = []

    for (const worker of Object.values(workers)) {
      if (worker.application === 'service-1') {
        service1Workers.push(worker)
      }
      if (worker.application === 'service-2') {
        service2Workers.push(worker)
      }
    }

    assert.strictEqual(service1Workers.length, 1)
    assert.strictEqual(service2Workers.length, 1)
  })

  test(`should not scale an applications when the worker property is set (configuration ${name})`, async t => {
    const configFile = join(fixturesDir, 'worker-scaler', file)
    const app = await createRuntime(configFile, null, {
      async transform (config, ...args) {
        config.applications = [
          { id: 'service-1', workers: 1 },
          { id: 'service-2', workers: 1 }
        ]
        config = await transform(config, ...args)
        return config
      }
    })

    const entryUrl = await app.start()

    t.after(() => app.close())

    const { statusCode } = await request(entryUrl + '/service-2/cpu-intensive', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ timeout: 1000 })
    })
    assert.strictEqual(statusCode, 200)

    await sleep(10000)

    const workers = await app.getWorkers()

    const service1Workers = []
    const service2Workers = []

    for (const worker of Object.values(workers)) {
      if (worker.application === 'service-1') {
        service1Workers.push(worker)
      }
      if (worker.application === 'service-2') {
        service2Workers.push(worker)
      }
    }

    assert.strictEqual(service1Workers.length, 1)
    assert.strictEqual(service2Workers.length, 1)
  })
}

test('should properly apply runtime workers configuration to the applications (number)', async t => {
  const originalConfigFile = join(fixturesDir, 'worker-scaler', 'platformatic.json')
  const configFile = join(fixturesDir, 'worker-scaler', 'platformatic.temp.json')
  await cp(originalConfigFile, configFile)
  t.after(() => safeRemove(configFile))

  const tmpDir = await mkdtemp(join(tmpdir(), 'platformatic-'))
  const logsPath = join(tmpDir, 'log.txt')

  await updateConfigFile(configFile, contents => {
    contents.workers = 3
    return contents
  })

  const app = await createRuntime(configFile, null, { logsPath })

  await app.start()
  t.after(() => app.close())

  const config = await app.getRuntimeConfig()

  deepStrictEqual(config.applications[0].workers, { dynamic: false, static: features.node.reusePort ? 3 : 1 }) // Entrypoint
  deepStrictEqual(config.applications[1].workers, { dynamic: false, static: 3 })
})

test('should properly apply runtime workers configuration to the applications (object)', async t => {
  const originalConfigFile = join(fixturesDir, 'worker-scaler', 'platformatic.json')
  const configFile = join(fixturesDir, 'worker-scaler', 'platformatic.temp.json')
  await cp(originalConfigFile, configFile)
  t.after(() => safeRemove(configFile))

  const tmpDir = await mkdtemp(join(tmpdir(), 'platformatic-'))
  const logsPath = join(tmpDir, 'log.txt')

  await updateConfigFile(configFile, contents => {
    contents.workers = {
      dynamic: true,
      static: 1,
      minimum: 2,
      maximum: 3
    }
    return contents
  })

  const app = await createRuntime(configFile, null, { logsPath })

  await app.start()
  t.after(() => app.close())

  const config = await app.getRuntimeConfig()

  // Entrypoint
  deepStrictEqual(
    config.applications[0].workers,
    features.node.reusePort ? { dynamic: true, static: 2, minimum: 2, maximum: 3 } : { dynamic: false, static: 1 }
  )
  deepStrictEqual(config.applications[1].workers, { dynamic: true, static: 2, minimum: 2, maximum: 3 })
})

test('should ensure the right order for minimum and maximum', async t => {
  const originalConfigFile = join(fixturesDir, 'worker-scaler', 'platformatic.json')
  const configFile = join(fixturesDir, 'worker-scaler', 'platformatic.temp.json')
  await cp(originalConfigFile, configFile)
  t.after(() => safeRemove(configFile))

  const tmpDir = await mkdtemp(join(tmpdir(), 'platformatic-'))
  const logsPath = join(tmpDir, 'log.txt')

  await updateConfigFile(configFile, contents => {
    contents.workers = {
      dynamic: true,
      static: 1,
      minimum: 4,
      maximum: 3
    }
    return contents
  })

  const app = await createRuntime(configFile, null, { logsPath })

  await app.start()
  t.after(() => app.close())

  const config = await app.getRuntimeConfig()

  // Entrypoint
  deepStrictEqual(
    config.applications[0].workers,
    features.node.reusePort ? { dynamic: true, static: 3, minimum: 3, maximum: 4 } : { dynamic: false, static: 1 }
  )
  deepStrictEqual(config.applications[1].workers, { dynamic: true, static: 3, minimum: 3, maximum: 4 })
})

test('should apply application scaleUpELU and scaleDownELU', async t => {
  const configFile = join(fixturesDir, 'worker-scaler', 'platformatic.worker-scaler.json')
  const app = await createRuntime(configFile, null, {
    async transform (config, ...args) {
      delete config.verticalScaler

      config.applications = [
        { id: 'service-1', workers: { scaleUpELU: 1 } },
        { id: 'service-2', workers: { scaleUpELU: 0.5 } }
      ]
      config.workers = {
        dynamic: true,
        minimum: 1,
        maximum: 5,
        scaleUpELU: 1,
        gracePeriod: 1
      }
      config = await transform(config, ...args)
      return config
    }
  })

  const entryUrl = await app.start()

  t.after(() => app.close())

  const { statusCode } = await request(entryUrl + '/service-2/cpu-intensive', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ timeout: 1000 })
  })
  assert.strictEqual(statusCode, 200)

  await sleep(10000)

  const workers = await app.getWorkers()

  const service1Workers = []
  const service2Workers = []

  for (const worker of Object.values(workers)) {
    if (worker.application === 'service-1') {
      service1Workers.push(worker)
    }
    if (worker.application === 'service-2') {
      service2Workers.push(worker)
    }
  }

  assert.strictEqual(service1Workers.length, 1)
  assert.strictEqual(service2Workers.length, 2)
})

test('logs worker health errors and refreshes the health check timeout', async t => {
  const error = new Error('health check failed')
  const errors = []
  let healthCheck
  let refreshes = 0

  t.mock.method(globalThis, 'setTimeout', callback => {
    healthCheck = callback
    return {
      refresh () {
        refreshes++
      }
    }
  })

  const runtime = {
    logger: {
      error (details, message) {
        errors.push({ details, message })
      }
    },
    async getWorkers () {
      return {
        worker: {
          raw: {
            [kWorkerStartTime]: 0,
            [kWorkerStatus]: 'started'
          }
        }
      }
    },
    async getWorkerHealth () {
      throw error
    }
  }
  const scaler = new DynamicWorkersScaler(runtime, { maxMemory: 1, gracePeriod: 0 })

  await scaler.start()
  t.after(() => scaler.stop())

  await healthCheck()

  assert.deepStrictEqual(errors, [{ details: { err: error }, message: 'Failed to get health for worker' }])
  assert.strictEqual(refreshes, 1)
})

test('should apply application scaleUpELU and scaleDownELU (vertical scaler))', async t => {
  const configFile = join(fixturesDir, 'worker-scaler', 'platformatic.worker-scaler.json')
  const app = await createRuntime(configFile, null, {
    async transform (config, ...args) {
      config.verticalScaler = {
        enabled: true,
        maxTotalWorkers: 5,
        gracePeriod: 1,
        scaleUpELU: 1,
        applications: {
          'service-1': { scaleUpELU: 1 },
          'service-2': { scaleUpELU: 0.5 }
        }
      }
      config = await transform(config, ...args)
      return config
    }
  })

  const entryUrl = await app.start()

  t.after(() => app.close())

  const { statusCode } = await request(entryUrl + '/service-2/cpu-intensive', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ timeout: 1000 })
  })
  assert.strictEqual(statusCode, 200)

  await sleep(10000)

  const workers = await app.getWorkers()

  const service1Workers = []
  const service2Workers = []

  for (const worker of Object.values(workers)) {
    if (worker.application === 'service-1') {
      service1Workers.push(worker)
    }
    if (worker.application === 'service-2') {
      service2Workers.push(worker)
    }
  }

  assert.strictEqual(service1Workers.length, 1)
  assert.strictEqual(service2Workers.length, 2)
})
