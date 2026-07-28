import { rejects, strictEqual } from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { setTimeout as sleep } from 'node:timers/promises'
import { transform } from '../../index.js'
import { createRuntime } from '../helpers.js'

const fixturesDir = join(import.meta.dirname, '..', '..', 'fixtures')

async function waitForStarting (app, applicationId) {
  let status
  for (let i = 0; i < 100; i++) {
    status = (await app.getApplicationDetails(applicationId)).status
    if (status === 'starting') {
      break
    }
    await sleep(10)
  }
  strictEqual(status, 'starting')
}

test('should stop an application while it is starting', async t => {
  const configFile = join(fixturesDir, 'parallel-management', 'platformatic.runtime.json')
  const app = await createRuntime(configFile, null, {
    async transform (config, ...args) {
      config = await transform(config, ...args)
      config.gracefulShutdown.application = 5000
      config.restartOnError = false
      return config
    }
  })

  await app.init()

  t.after(async () => {
    await app.close()
  })

  let stopTimeouts = 0
  let exitTimeouts = 0
  app.on('application:worker:stop:timeout', () => stopTimeouts++)
  app.on('application:worker:exit:timeout', () => exitTimeouts++)

  const startPromise = app.startApplication('service-1')

  await waitForStarting(app, 'service-1')

  await Promise.all([startPromise, app.stopApplication('service-1')])

  strictEqual(stopTimeouts, 0)
  strictEqual(exitTimeouts, 0)
  strictEqual((await app.getApplicationDetails('service-1', true)).status, 'stopped')
})

test('should stop an application when starting fails', async t => {
  const configFile = join(fixturesDir, 'parallel-management', 'platformatic.with-failure.runtime.json')
  const app = await createRuntime(configFile, null, {
    async transform (config, ...args) {
      config = await transform(config, ...args)
      config.gracefulShutdown.application = 5000
      return config
    }
  })

  await app.init()

  t.after(async () => {
    await app.close()
  })

  let stopTimeouts = 0
  let exitTimeouts = 0
  app.on('application:worker:stop:timeout', () => stopTimeouts++)
  app.on('application:worker:exit:timeout', () => exitTimeouts++)

  const startPromise = app.startApplication('service-3')
  const startRejection = rejects(startPromise, /Service 3 failed to start/)

  await waitForStarting(app, 'service-3')

  await Promise.all([startRejection, app.stopApplication('service-3')])

  strictEqual(stopTimeouts, 0)
  strictEqual(exitTimeouts, 0)
  strictEqual((await app.getApplicationDetails('service-3', true)).status, 'stopped')
})

test('should handle another start command while an application is starting', async t => {
  const configFile = join(fixturesDir, 'parallel-management', 'platformatic.runtime.json')
  const app = await createRuntime(configFile)

  await app.init()

  t.after(async () => {
    await app.close()
  })

  const startPromise = app.startApplication('service-1')

  await waitForStarting(app, 'service-1')
  await Promise.all([startPromise, app.sendCommandToApplication('service-1', 'start')])

  strictEqual((await app.getApplicationDetails('service-1')).status, 'started')
})
