'use strict'

const assert = require('node:assert')
const { test } = require('node:test')
const { join } = require('node:path')
const { buildStackable } = require('../..')

test('get service info via stackable api', async (t) => {
  const projectRoot = join(__dirname, '..', 'fixtures', 'directories')
  const config = join(projectRoot, 'platformatic.service.json')

  const stackable = await buildStackable({ config })
  t.after(async () => {
    await stackable.stop()
  })
  await stackable.start()

  assert.strictEqual(stackable.app.platformatic.configManager.dirname, projectRoot)
})
