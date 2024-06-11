'use strict'
const assert = require('node:assert')
const { platformaticRuntime } = require('../..')
const { join } = require('node:path')
const { test } = require('node:test')
const { loadConfig } = require('@platformatic/config')
const fixturesDir = join(__dirname, '..', '..', 'fixtures')
const { buildRuntime } = require('../../lib/start')

test('startes with port +1 when current port is allocated', async () => {
  const configFile = join(fixturesDir, 'configs', 'monorepo-port-3000.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildRuntime(config.configManager)
  const res = await app.start()
  assert.strictEqual('Hello', res)
})
