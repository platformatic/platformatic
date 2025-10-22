import assert from 'node:assert'
import { mkdtemp } from 'node:fs/promises'
import { availableParallelism, tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { setTimeout as sleep } from 'node:timers/promises'
import { request } from 'undici'
import { transform } from '../lib/config.js'
import { createRuntime } from './helpers.js'

const fixturesDir = join(import.meta.dirname, '..', 'fixtures')

test('should not scale an applications when the app maxWorkers is reached', async t => {
  const configFile = join(fixturesDir, 'vertical-scaler', 'platformatic.json')

  const tmpDir = await mkdtemp(join(tmpdir(), 'platformatic-'))
  const logsPath = join(tmpDir, 'log.txt')

  const app = await createRuntime(configFile, null, {
    async transform (config, ...args) {
      config = await transform(config, ...args)
      config.verticalScaler = {
        enabled: true,
        applications: {
          'service-1': { maxWorkers: 1 },
          'service-2': { maxWorkers: 1 },
          'non-existing-app': { maxWorkers: 1 }
        },
        maxTotalMemory: 1000000
      }

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

  const maxTotalWorkers = availableParallelism()
  const maxWorkers = maxTotalWorkers

  const verticalScalerConfig = app.getVerticalScaler().getConfig()
  assert.deepStrictEqual(verticalScalerConfig, {
    applications: {
      'non-existing-app': { maxWorkers: 1 },
      'service-1': { maxWorkers: 1 },
      'service-2': { maxWorkers: 1 }
    },
    maxTotalWorkers,
    maxTotalMemory: 1000000,
    maxWorkers,
    minWorkers: 1,
    scaleDownELU: 0.2,
    scaleIntervalSec: 60,
    scaleUpELU: 0.8,
    scaleUpTimeWindowSec: 10,
    scaleDownTimeWindowSec: 60,
    cooldown: 60,
    gracePeriod: 30 * 1000
  })
})

test('should scale a standalone application if elu is higher than treshold', async t => {
  const configFile = join(fixturesDir, 'vertical-scaler-service', 'platformatic.json')

  const app = await createRuntime(configFile, null, {
    async transform (config, ...args) {
      config = await transform(config, ...args)
      config.verticalScaler.maxTotalMemory = 1000000

      return config
    }
  })

  const entryUrl = await app.start()

  t.after(() => app.close())

  const { statusCode } = await request(entryUrl + '/cpu-intensive', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ timeout: 1000 })
  })
  assert.strictEqual(statusCode, 200)

  await sleep(10000)

  const workers = await app.getWorkers()

  const serviceWorkers = []
  for (const worker of Object.values(workers)) {
    if (worker.application === 'service-2') {
      serviceWorkers.push(worker)
    }
  }

  const maxTotalWorkers = 10
  const verticalScalerConfig = app.getVerticalScaler().getConfig()

  assert.deepStrictEqual(verticalScalerConfig, {
    applications: {},
    maxTotalWorkers,
    maxTotalMemory: 1000000,
    maxWorkers: 2,
    minWorkers: 1,
    scaleDownELU: 0.2,
    scaleIntervalSec: 60,
    scaleUpELU: 0.8,
    scaleUpTimeWindowSec: 10,
    scaleDownTimeWindowSec: 60,
    cooldown: 60,
    gracePeriod: 30 * 1000
  })
})

test.skip('should scale applications to their min workers at start', async t => {
  const configFile = join(fixturesDir, 'vertical-scaler', 'platformatic.json')
  const app = await createRuntime(configFile, null, {
    async transform (config, ...args) {
      config = await transform(config, ...args)
      config.verticalScaler = {
        enabled: true,
        minWorkers: 3
      }
      return config
    }
  })
  await app.start()

  t.after(() => app.close())

  await sleep(5000)

  const workers = await app.getWorkers()

  const service2Workers = []

  for (const worker of Object.values(workers)) {
    if (worker.application === 'service-2') {
      service2Workers.push(worker)
    }
  }
  assert.strictEqual(service2Workers.length, 3)
})

test('should not scale an application is there is not enough memory', async t => {
  const configFile = join(fixturesDir, 'vertical-scaler', 'platformatic.json')
  const app = await createRuntime(configFile, null, {
    async transform (config, ...args) {
      config = await transform(config, ...args)
      config.verticalScaler = {
        enabled: true,
        maxTotalWorkers: 5,
        maxTotalMemory: 1,
        gracePeriod: 1
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
  assert.strictEqual(service2Workers.length, 1)
})
