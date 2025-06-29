'use strict'

const assert = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')

const { loadConfig } = require('@platformatic/config')
const { buildServer, platformaticRuntime } = require('../..')
const fixturesDir = join(__dirname, '..', '..', 'fixtures')
const { setLogFile } = require('../helpers')

test.beforeEach(setLogFile)

const platformaticVersion = require('../../package.json').version

test('should get service details', async t => {
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildServer(config.configManager.current)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  const serviceDetails = await app.getServiceDetails('with-logger')
  assert.deepStrictEqual(serviceDetails, {
    id: 'with-logger',
    type: 'service',
    status: 'started',
    version: platformaticVersion,
    entrypoint: false,
    localUrl: 'http://with-logger.plt.local',
    dependencies: []
  })
})
