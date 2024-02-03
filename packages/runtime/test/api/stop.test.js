'use strict'

const assert = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')

const { loadConfig } = require('@platformatic/config')
const { buildServer, platformaticRuntime } = require('../..')
const fixturesDir = join(__dirname, '..', '..', 'fixtures')

test('should stop service by service id', async (t) => {
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildServer(config.configManager.current)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  {
    const serviceDetails = await app.getServiceDetails('with-logger')
    assert.strictEqual(serviceDetails.status, 'started')
  }

  await app.stopService('with-logger')

  {
    const serviceDetails = await app.getServiceDetails('with-logger')
    assert.strictEqual(serviceDetails.status, 'stopped')
  }
})

test('should fail to stop service with a wrong id', async (t) => {
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildServer(config.configManager.current)

  t.after(async () => {
    await app.close()
  })

  try {
    await app.stopService('wrong-service-id')
    assert.fail('should have thrown')
  } catch (err) {
    assert.strictEqual(err.message, 'Service with id \'wrong-service-id\' not found')
  }
})

test('should start stopped service by service id', async (t) => {
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildServer(config.configManager.current)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  await app.stopService('with-logger')

  {
    const serviceDetails = await app.getServiceDetails('with-logger')
    assert.strictEqual(serviceDetails.status, 'stopped')
  }

  await app.startService('with-logger')

  {
    const serviceDetails = await app.getServiceDetails('with-logger')
    assert.strictEqual(serviceDetails.status, 'started')
  }
})
