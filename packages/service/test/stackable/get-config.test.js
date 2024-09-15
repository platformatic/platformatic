'use strict'

const assert = require('node:assert')
const { test } = require('node:test')
const { join } = require('node:path')
const { buildStackable } = require('../..')
const rfdc = require('rfdc')()

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

  const stackable = await buildStackable({
    config: rfdc(config),
  })
  t.after(async () => {
    await stackable.stop()
  })
  await stackable.start()

  const stackableConfig = await stackable.getConfig()
  assert.deepStrictEqual(stackableConfig, {
    server: {
      hostname: '127.0.0.1',
      port: 0,
      logger: {
        level: 'trace'
      },
      keepAliveTimeout: 5000,
      trustProxy: true
    },
    plugins: {
      paths: [join(__dirname, '..', 'fixtures', 'directories', 'routes')],
    },
    watch: {
      enabled: false
    },
    metrics: false,
  })
})
