'use strict'

const assert = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')

const { create } = require('../../index.js')
const fixturesDir = join(__dirname, '..', '..', 'fixtures')
const { setLogFile } = require('../helpers')

test.beforeEach(setLogFile)

test('should fail to get service config if service is not started', async t => {
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')
  const app = await create(configFile)
  await app.init()

  t.after(async () => {
    await app.close()
  })

  try {
    await app.getServiceConfig('with-logger')
    assert.fail('should have thrown')
  } catch (err) {
    assert.strictEqual(err.message, "Service with id 'with-logger' is not started")
  }
})
