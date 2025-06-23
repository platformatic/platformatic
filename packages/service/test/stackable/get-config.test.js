'use strict'

const assert = require('node:assert')
const { test } = require('node:test')
const { join } = require('node:path')
const { createStackable } = require('../..')

test('get service config via stackable api', async t => {
  const projectRoot = join(__dirname, '..', 'fixtures', 'directories')

  const stackable = await createStackable(projectRoot)
  t.after(() => stackable.stop())
  await stackable.start({ listen: true })

  const stackableConfig = await stackable.getConfig()
  assert.deepStrictEqual(stackableConfig, {
    server: {
      hostname: '127.0.0.1',
      port: 0,
      logger: {
        level: 'fatal'
      },
      keepAliveTimeout: 5000,
      trustProxy: true
    },
    plugins: {
      paths: [join(__dirname, '..', 'fixtures', 'directories', 'routes')]
    },
    watch: {
      enabled: false
    },
    metrics: false
  })
})
