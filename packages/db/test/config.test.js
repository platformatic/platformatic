'use strict'

const assert = require('node:assert/strict')
const { test } = require('node:test')
const { buildServer } = require('..')
const { buildConfigManager, getConnectionInfo } = require('./helper')

test('should set pluginTimeout to 60s by default', async (t) => {
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

  const configManager = await buildConfigManager(config)
  const app = await buildServer({ configManager })

  t.after(async () => {
    await app.close()
    await dropTestDB()
  })
  await app.start()

  const appConfig = app.platformatic.configManager.current
  assert.equal(appConfig.server.pluginTimeout, 60 * 1000)
})
