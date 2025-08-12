'use strict'

const assert = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')

const { createRuntime } = require('../helpers.js')
const fixturesDir = join(__dirname, '..', '..', 'fixtures')

test('should stop service by service id', async t => {
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')
  const app = await createRuntime(configFile)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  {
    const serviceDetails = await app.getServiceDetails('with-logger')
    assert.strictEqual(serviceDetails.status, 'started')
  }

  await app.stopService('with-logger')

  {
    const serviceDetails = await app.getServiceDetails('with-logger', true)
    assert.strictEqual(serviceDetails.status, 'stopped')
  }
})
