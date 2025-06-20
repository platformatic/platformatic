'use strict'

const assert = require('node:assert')
const { test } = require('node:test')
const { join } = require('node:path')
const { createStackable } = require('../..')

test('get service info via stackable api', async t => {
  const projectRoot = join(__dirname, '..', 'fixtures', 'directories')

  const stackable = await createStackable(projectRoot)
  t.after(() => stackable.stop())
  await stackable.start({ listen: true })

  assert.strictEqual(stackable.getApplication().platformatic.configManager.dirname, projectRoot)
})
