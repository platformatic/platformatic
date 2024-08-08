'use strict'

const assert = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')

const { loadConfig } = require('@platformatic/config')
const { buildServer, platformaticRuntime } = require('../..')
const fixturesDir = join(__dirname, '..', '..', 'fixtures')

test('should kill the thread even if stop fails', async (t) => {
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildServer(config.configManager.current)

  await app.start()

  const { statusCode } = await app.inject('with-logger', {
    method: 'GET',
    url: '/crash-on-close',
  })
  assert.strictEqual(statusCode, 200)

  // Should not fail and hang
  await app.close()
})
