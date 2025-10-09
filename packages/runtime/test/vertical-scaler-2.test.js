import assert from 'node:assert'
import { test } from 'node:test'
import { join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { createRuntime } from './helpers.js'
import { transform } from '../lib/config.js'

const fixturesDir = join(import.meta.dirname, '..', 'fixtures')

test('should scale applications to their min workers at start', async t => {
  const configFile = join(fixturesDir, 'vertical-scaler', 'platformatic.json')
  const app = await createRuntime(configFile, null, {
    async transform (config, ...args) {
      config = await transform(config, ...args)
      config.verticalScaler = {
        enabled: true,
        minWorkers: 2
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
  assert.strictEqual(service2Workers.length, 2)
})
