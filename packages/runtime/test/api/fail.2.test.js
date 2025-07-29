'use strict'

const assert = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')

const { create } = require('../../index.js')
const fixturesDir = join(__dirname, '..', '..', 'fixtures')
const { setLogFile } = require('../helpers')

test.beforeEach(setLogFile)

test('should fail to start service with a wrong id', async t => {
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')
  const app = await create(configFile)
  await app.init()

  t.after(async () => {
    await app.close()
  })

  try {
    await app.startService('wrong-service-id')
    assert.fail('should have thrown')
  } catch (err) {
    assert.strictEqual(
      err.message,
      'Service wrong-service-id not found. Available services are: db-app, serviceApp, with-logger, multi-plugin-service'
    )
  }
})
