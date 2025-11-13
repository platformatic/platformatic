import assert from 'node:assert'
import { once } from 'node:events'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { setTimeout as sleep } from 'node:timers/promises'
import { request } from 'undici'
import { transform } from '../lib/config.js'
import { createRuntime } from './helpers.js'

const fixturesDir = join(import.meta.dirname, '..', 'fixtures')

const configurations = {
  default: 'platformatic.json',
  'worker-scaler': 'platformatic.worker-scaler.json'
}

for (const [name, file] of Object.entries(configurations)) {
  test(`should not scale an applications when the app maxWorkers is reached (configuration ${name})`, async t => {
    const configFile = join(fixturesDir, 'worker-scaler', file)

    const tmpDir = await mkdtemp(join(tmpdir(), 'platformatic-'))
    const logsPath = join(tmpDir, 'log.txt')

    const app = await createRuntime(configFile, null, {
      async transform (config, ...args) {
        config = await transform(config, ...args)

        config.workers.maxMemory = 1000000
        config.applications.find(a => a.id === 'service-1').workers.maximum = 1
        config.applications.find(a => a.id === 'service-2').workers.maximum = 1

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

    const maxTotalWorkers = 10
    const maxWorkers = maxTotalWorkers

    const verticalScalerConfig = app.getDynamicWorkersScaler().getConfig()
    assert.deepStrictEqual(verticalScalerConfig, {
      maxTotalWorkers,
      maxTotalMemory: 1000000,
      maxWorkers,
      minWorkers: 1,
      cooldown: 60000,
      gracePeriod: 1000
    })
  })

  test(`should scale a standalone application if elu is higher than treshold (configuration ${name})`, async t => {
    const configFile = join(fixturesDir, 'worker-scaler-service', file)

    const app = await createRuntime(configFile, null, {
      async transform (config, ...args) {
        config = await transform(config, ...args)
        config.workers.maxMemory = 1000000

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
    const verticalScalerConfig = app.getDynamicWorkersScaler().getConfig()

    assert.deepStrictEqual(verticalScalerConfig, {
      maxTotalWorkers,
      maxTotalMemory: 1000000,
      maxWorkers: 2,
      minWorkers: 1,
      cooldown: 60000,
      gracePeriod: 30000
    })
  })

  test(`should scale applications to their min workers at start (configuration ${name})`, async t => {
    const configFile = join(fixturesDir, 'worker-scaler', file)
    const app = await createRuntime(configFile, null, {
      async transform (config, ...args) {
        config = await transform(config, ...args)
        config.workers.minimum = 3
        return config
      }
    })

    const updatePromise = once(app, 'application:resources:workers:updated')
    await app.start()

    t.after(() => app.close())

    await updatePromise
    const workers = await app.getWorkers()

    const service2Workers = []

    for (const worker of Object.values(workers)) {
      if (worker.application === 'service-2') {
        service2Workers.push(worker)
      }
    }
    assert.strictEqual(service2Workers.length, 3)
  })

  test(`should not scale an application is there is not enough memory (configuration ${name})`, async t => {
    const configFile = join(fixturesDir, 'worker-scaler', file)
    const app = await createRuntime(configFile, null, {
      async transform (config, ...args) {
        config = await transform(config, ...args)

        config.workers.maxMemory = 1
        config.workers.maximum = 5

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
