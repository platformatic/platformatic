'use strict'

const assert = require('node:assert')
const { test } = require('node:test')
const { join } = require('node:path')
const { buildStackable } = require('../..')

test('get service config via stackable api', async (t) => {
  const config = {
    composer: {
      services: [],
    },
    plugins: {
      paths: [join(__dirname, '..', 'openapi', 'fixtures', 'plugins', 'custom.js')],
    },
  }

  const stackable = await buildStackable({ config })
  t.after(async () => {
    await stackable.stop()
  })
  await stackable.start()

  const stackableConfig = await stackable.getConfig()
  assert.deepStrictEqual(stackableConfig, {
    composer: {
      services: [],
      refreshTimeout: 1000,
      addEmptySchema: false,
    },
    plugins: {
      paths: [join(__dirname, '..', 'openapi', 'fixtures', 'plugins', 'custom.js')],
    },
    server: {
      keepAliveTimeout: 5000,
      logger: {
        level: 'trace',
      },
    },
    watch: {
      enabled: false,
    },
  })
})
