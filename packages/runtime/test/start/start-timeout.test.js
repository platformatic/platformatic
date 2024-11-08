'use strict'

const { join } = require('node:path')
const { test } = require('node:test')
const { buildServer } = require('../..')
const fixturesDir = join(__dirname, '..', '..', 'fixtures')

test('can start timeout when applications dont start', async t => {
  const configFile = join(fixturesDir, 'start-timeout/platformatic.json')
  const app = await buildServer(configFile)
  await app.start()

  t.after(async () => {
    await app.close()
  })
})
