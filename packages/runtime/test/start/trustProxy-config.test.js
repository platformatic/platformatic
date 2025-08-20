'use strict'

const assert = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')
const { createRuntime } = require('../helpers.js')
const fixturesDir = join(__dirname, '..', '..', 'fixtures')

test('all applications have trustProxy = true in server config (except entrypoint)', async t => {
  const configFile = join(fixturesDir, 'configs', 'monorepo-composer.json')
  const app = await createRuntime(configFile)
  await app.start()
  const applications = await app.getApplications()

  for (const s of applications.applications) {
    const config = await app.getApplicationConfig(s.id)
    if (s.entrypoint) {
      assert.equal(config.server.trustProxy, undefined)
    } else {
      assert.equal(config.server.trustProxy, true)
    }
  }
  t.after(async () => {
    await app.close()
  })
})
