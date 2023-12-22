'use strict'

const assert = require('node:assert/strict')
const { test } = require('node:test')
const { buildServer } = require('..')
const { buildConfigManager, getConnectionInfo } = require('./helper')

test('should set pluginTimeout to 60s by default', async (t) => {
  console.log('--------------> 1')
  const { connectionInfo, dropTestDB } = await getConnectionInfo()

  const config = {
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    db: {
      ...connectionInfo
    }
  }

  console.log('--------------> 2')
  const configManager = await buildConfigManager(config)
  console.log('--------------> 3')
  const app = await buildServer({ configManager })

  t.after(async () => {
    console.log('--------------> 7')
    await app.close()
    console.log('--------------> 8')
    await dropTestDB()
    console.log('--------------> 9')
  })

  console.log('--------------> 4')
  await app.start()

  console.log('--------------> 5')
  const appConfig = app.platformatic.configManager.current
  assert.equal(appConfig.server.pluginTimeout, 60 * 1000)

  console.log('--------------> 6')
})
