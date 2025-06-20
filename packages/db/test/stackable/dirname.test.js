'use strict'

const assert = require('node:assert')
const { test } = require('node:test')
const { join } = require('node:path')
const { createStackable } = require('../..')

test('get service info via stackable api', async t => {
  const projectRoot = join(__dirname, '..', 'fixtures', 'sqlite-basic')
  const config = join(projectRoot, 'platformatic.db.json')

  process.env.DATABASE_URL = 'sqlite://:memory:'
  const stackable = await createStackable(projectRoot, config)
  t.after(async () => {
    await stackable.stop()
  })
  await stackable.start({ listen: true })

  assert.strictEqual(stackable.getApplication().platformatic.configManager.dirname, projectRoot)
})
