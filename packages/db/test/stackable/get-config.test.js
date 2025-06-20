'use strict'

const assert = require('node:assert/strict')
const { test } = require('node:test')
const { join } = require('node:path')
const { createStackableFromConfig, getConnectionInfo } = require('../helper')

test('get service config via stackable api', async t => {
  const workingDir = join(__dirname, '..', 'fixtures', 'directories')
  const { connectionInfo, dropTestDB } = await getConnectionInfo()

  const stackable = await createStackableFromConfig(t, {
    server: {
      hostname: '127.0.0.1',
      port: 0,
      logger: { level: 'fatal' }
    },
    db: {
      ...connectionInfo
    },
    plugins: {
      paths: [join(workingDir, 'routes')]
    },
    watch: {
      enabled: false
    },
    metrics: false
  })

  t.after(async () => {
    await stackable.stop()
    await dropTestDB()
  })
  await stackable.start({ listen: true })

  const stackableConfig = await stackable.getConfig()
  assert.deepStrictEqual(stackableConfig, {
    db: {
      ...connectionInfo
    },
    metrics: false,
    plugins: {
      paths: [join(workingDir, 'routes')]
    },
    server: {
      hostname: '127.0.0.1',
      port: 0,
      keepAliveTimeout: 5000,
      logger: {
        level: 'fatal'
      },
      pluginTimeout: 60000
    },
    watch: {
      enabled: false
    }
  })
})
