'use strict'

const assert = require('node:assert')
const { test } = require('node:test')
const { join } = require('node:path')
const { create, version } = require('../..')

test('get service info via stackable api', async t => {
  const stackable = await create(join(__dirname, '..', 'fixtures', 'directories'))
  t.after(() => stackable.stop())
  await stackable.start({ listen: true })

  const stackableInfo = await stackable.getInfo()
  assert.deepStrictEqual(stackableInfo, { type: 'service', version })
})
