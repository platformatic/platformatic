'use strict'

const assert = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')

const { create } = require('../../index.js')
const fixturesDir = join(__dirname, '..', '..', 'fixtures')
const { setLogFile } = require('../helpers')

test.beforeEach(setLogFile)

test('should fail to start running service', async t => {
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')
  const app = await create(configFile)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  try {
    await app.startService('with-logger')
    assert.fail('should have thrown')
  } catch (err) {
    assert.strictEqual(err.message, 'Application is already started')
  }
})
