import { features, safeRemove } from '@platformatic/foundation'
import assert, { deepStrictEqual } from 'node:assert'
import { cp, mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { setTimeout as sleep } from 'node:timers/promises'
import { request } from 'undici'
import { transform } from '../lib/config.js'
import { createRuntime, updateConfigFile } from './helpers.js'

const fixturesDir = join(import.meta.dirname, '..', 'fixtures')

const configurations = {
  default: 'platformatic.json',
  'worker-scaler': 'platformatic.worker-scaler.json'
}

for (const [name, file] of Object.entries(configurations)) {
  test(`should scale an application if elu is higher than treshold (configuration ${name})`, async t => {
    const configFile = join(fixturesDir, 'worker-scaler', file)
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
