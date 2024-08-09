'use strict'

const assert = require('node:assert')
const { test } = require('node:test')
const { join } = require('node:path')
const { buildStackable } = require('../..')

const pltVersion = require('../../package.json').version

test('get service info via stackable api', async (t) => {
  const config = {
    server: {
      hostname: '127.0.0.1',
      port: 0,
    },
    plugins: {
      paths: [join(__dirname, '..', 'fixtures', 'directories', 'routes')],
    },
    watch: false,
    metrics: false,
  }

  const { stackable } = await buildStackable({ config })
  t.after(async () => {
    await stackable.stop()
  })
  await stackable.start()

  const stackableInfo = await stackable.getInfo()
  assert.deepStrictEqual(stackableInfo, {
    type: 'service',
    version: pltVersion,
  })
})
