'use strict'

const assert = require('node:assert')
const { test } = require('node:test')
const { join } = require('node:path')
const { buildStackable } = require('../..')

test('get service config via stackable api', async (t) => {
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

  const { stackable } = await buildStackable(config)
  t.after(async () => {
    await stackable.stop()
  })
  await stackable.start()

  const stackableConfig = await stackable.getConfig()
  assert.deepStrictEqual(stackableConfig, config)
})
