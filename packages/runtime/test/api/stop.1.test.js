'use strict'

const assert = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')

const { createRuntime } = require('../helpers.js')
const fixturesDir = join(__dirname, '..', '..', 'fixtures')

test('should stop application by application id', async t => {
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')
  const app = await createRuntime(configFile)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  {
    const applicationDetails = await app.getApplicationDetails('with-logger')
    assert.strictEqual(applicationDetails.status, 'started')
  }

  await app.stopApplication('with-logger')

  {
    const applicationDetails = await app.getApplicationDetails('with-logger', true)
    assert.strictEqual(applicationDetails.status, 'stopped')
  }
})
