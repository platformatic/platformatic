'use strict'

const assert = require('node:assert')
const { test } = require('node:test')
const { join } = require('node:path')
const { buildStackable } = require('../..')

const pltVersion = require('../../package.json').version

test('get service info via stackable api', async (t) => {
  const config = {
    composer: {
      services: [],
    },
    plugins: {
      paths: [join(__dirname, '..', 'openapi', 'fixtures', 'plugins', 'custom.js')],
    },
  }

  const { stackable } = await buildStackable({ config })
  t.after(async () => {
    await stackable.stop()
  })
  await stackable.start()

  const stackableInfo = await stackable.getInfo()
  assert.deepStrictEqual(stackableInfo, {
    type: 'composer',
    version: pltVersion,
  })
})
