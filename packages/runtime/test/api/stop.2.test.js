'use strict'

const assert = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')

const { createRuntime } = require('../helpers.js')
const fixturesDir = join(__dirname, '..', '..', 'fixtures')

test('should fail to stop application with a wrong id', async t => {
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')
  const app = await createRuntime(configFile)
  await app.init()

  t.after(async () => {
    await app.close()
  })

  try {
    await app.stopApplication('wrong-service-id')
    assert.fail('should have thrown')
  } catch (err) {
    assert.strictEqual(
      err.message,
      'Application wrong-service-id not found. Available applications are: db-app, serviceApp, with-logger, multi-plugin-service'
    )
  }
})
