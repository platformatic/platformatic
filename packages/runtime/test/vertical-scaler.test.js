import assert from 'node:assert'
import { test } from 'node:test'
import { join } from 'node:path'
import { tmpdir, availableParallelism } from 'node:os'
import { setTimeout as sleep } from 'node:timers/promises'
import { mkdtemp, readFile } from 'node:fs/promises'
import { request } from 'undici'
import { createRuntime } from './helpers.js'
import { transform } from '../lib/config.js'

const fixturesDir = join(import.meta.dirname, '..', 'fixtures')

test('should scale an application if elu is higher than treshold', async t => {
  const configFile = join(fixturesDir, 'vertical-scaler', 'platformatic.json')
  const app = await createRuntime(configFile)
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

test('should not scale an application when the scaler is the cooldown', async t => {
  const configFile = join(fixturesDir, 'vertical-scaler', 'platformatic.json')
  const app = await createRuntime(configFile, null, {
    async transform (config, ...args) {
      config = await transform(config, ...args)
      config.verticalScaler = {
        enabled: true,
        maxTotalWorkers: 5
      }
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

test('should not scale applications when the worker property is set', async t => {
  const configFile = join(fixturesDir, 'vertical-scaler', 'platformatic.json')
  const app = await createRuntime(configFile, null, {
    async transform (config, ...args) {
      config = await transform(config, ...args)
      config.workers = 1
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

test('should not scale an applications when the worker property is set', async t => {
  const configFile = join(fixturesDir, 'vertical-scaler', 'platformatic.json')
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

test('should not scale an applications when the app maxWorkers is reached', async t => {
  const configFile = join(fixturesDir, 'vertical-scaler', 'platformatic.json')

  const tmpDir = await mkdtemp(join(tmpdir(), 'platformatic-'))
  const logsPath = join(tmpDir, 'log.txt')

  let runtimeConfig = null
  const app = await createRuntime(configFile, null, {
    async transform (config, ...args) {
      config = await transform(config, ...args)
      config.verticalScaler = {
        enabled: true,
        applications: {
          'service-1': { maxWorkers: 1 },
          'service-2': { maxWorkers: 1 },
          'non-existing-app': { maxWorkers: 1 }
        }
      }
      runtimeConfig = config
      return config
    },
    logsPath
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

  const logs = await readFile(logsPath, 'utf-8')
  assert.ok(logs.includes(
    'Vertical scaler configuration has a configuration for non-existing application \\"non-existing-app\\"'
  ))

  const maxTotalWorkers = availableParallelism()
  const maxWorkers = maxTotalWorkers

  const verticalScalerConfig = runtimeConfig?.verticalScaler
  assert.deepStrictEqual(verticalScalerConfig, {
    enabled: true,
    applications: {
      'service-1': { minWorkers: 1, maxWorkers: 1 },
      'service-2': { minWorkers: 1, maxWorkers: 1 }
    },
    maxTotalWorkers,
    maxWorkers,
    minWorkers: 1,
    minELUDiff: 0.2,
    scaleDownELU: 0.2,
    scaleIntervalSec: 60,
    scaleUpELU: 0.8,
    timeWindowSec: 60,
    cooldownSec: 60
  })
})
