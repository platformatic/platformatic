'use strict'

const assert = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')

const { loadConfig } = require('@platformatic/config')
const { buildServer, platformaticRuntime } = require('../..')
const fixturesDir = join(__dirname, '..', '..', 'fixtures')
const { setLogFile } = require('../helpers')

test.beforeEach(setLogFile)

test('should stop service by service id', async t => {
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
    const serviceDetails = await app.getServiceDetails('with-logger', true)
    assert.strictEqual(serviceDetails.status, 'stopped')
  }
})
