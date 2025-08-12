'use strict'

const assert = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')

const { createRuntime } = require('../helpers.js')
const fixturesDir = join(__dirname, '..', '..', 'fixtures')

test('does not wait forever if worker exits during api operation', async t => {
  const configFile = join(fixturesDir, 'configs', 'service-throws-on-start.json')
  const app = await createRuntime(configFile)

  t.after(async () => {
    await app.close()
  })

  await assert.rejects(async () => {
    await app.start()
  }, /The service "serviceThrowsOnStart" exited prematurely with error code 1/)
})
