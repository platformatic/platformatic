'use strict'

const assert = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')

const { create } = require('../../index.js')
const fixturesDir = join(__dirname, '..', '..', 'fixtures')
const { setLogFile } = require('../helpers')

test.beforeEach(setLogFile)

test('should kill the thread even if stop fails', async t => {
  const configFile = join(fixturesDir, 'configs', 'monorepo.json')
  const app = await create(configFile)

  await app.start()

  const { statusCode } = await app.inject('with-logger', {
    method: 'GET',
    url: '/crash-on-close'
  })
  assert.strictEqual(statusCode, 200)

  // Should not fail and hang
  const start = process.hrtime.bigint()
  await app.close()
  const elapsed = Number(process.hrtime.bigint() - start) / 1e6

  // We are satisfied if killing took less that twice of the allowed timeout
  const config = await app.getRuntimeConfig()
  assert.ok(elapsed < config.gracefulShutdown.runtime * 2)
})
