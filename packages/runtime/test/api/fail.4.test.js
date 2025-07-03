'use strict'

const assert = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')

const { loadConfig } = require('@platformatic/config')
const { buildServer, platformaticRuntime } = require('../..')
const fixturesDir = join(__dirname, '..', '..', 'fixtures')
const { setLogFile } = require('../helpers')

test.beforeEach(setLogFile)

test('does not wait forever if worker exits during api operation', async t => {
  const configFile = join(fixturesDir, 'configs', 'service-throws-on-start.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildServer(config.configManager.current)

  t.after(async () => {
    await app.close()
  })

  await assert.rejects(async () => {
    await app.start()
  }, /The service "serviceThrowsOnStart" exited prematurely with error code 1/)
})
