'use strict'

const assert = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')

const { loadConfig } = require('@platformatic/config')
const { buildServer, platformaticRuntime } = require('../..')
const fixturesDir = join(__dirname, '..', '..', 'fixtures')

test('does not wait forever if worker exits during api operation', async (t) => {
  const configFile = join(fixturesDir, 'configs', 'service-throws-on-start.json')
  const config = await loadConfig({}, ['-c', configFile], platformaticRuntime)
  const app = await buildServer(config.configManager.current)

  await assert.rejects(async () => {
    await app.start()
  }, /The runtime exited before the operation completed/)

  // TODO(mcollina): remove this (see lib/start.js)
  process.exitCode = 0
})
