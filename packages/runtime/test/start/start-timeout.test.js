'use strict'

const { rejects } = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')
const { createRuntime } = require('../helpers.js')
const fixturesDir = join(__dirname, '..', '..', 'fixtures')
const { waitForEvents } = require('../multiple-workers/helper')

test('can start timeout when applications dont start', async t => {
  const configFile = join(fixturesDir, 'start-timeout/platformatic.json')
  const app = await createRuntime(configFile)

  t.after(async () => {
    await app.close()
  })

  const waitPromise = waitForEvents(
    app,
    { event: 'application:worker:starting', application: 'node', worker: 0 },
    { event: 'application:worker:startTimeout', application: 'node', worker: 0 }
  )

  await rejects(() => app.start())

  await app.stop()
  await waitPromise
})
