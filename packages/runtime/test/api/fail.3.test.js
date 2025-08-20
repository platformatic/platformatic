'use strict'

const assert = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')

const { createRuntime } = require('../helpers.js')
const fixturesDir = join(__dirname, '..', '..', 'fixtures')

test('should fail to start running application', async t => {
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')
  const app = await createRuntime(configFile)

  await app.start()

  t.after(async () => {
    await app.close()
  })

  try {
    await app.startApplication('with-logger')
    assert.fail('should have thrown')
  } catch (err) {
    assert.strictEqual(err.message, 'Application is already started')
  }
})
