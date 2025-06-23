'use strict'

const assert = require('node:assert/strict')
const { test } = require('node:test')
const { createStackableFromConfig, getConnectionInfo } = require('./helper')

test('should set pluginTimeout to 60s by default', async t => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo()

  const app = await createStackableFromConfig(t, {
    server: {
      hostname: '127.0.0.1',
      port: 0,
      logger: { level: 'fatal' }
    },
    db: {
      ...connectionInfo
    }
  })

  t.after(async () => {
    await app.stop()
    await dropTestDB()
  })
  await app.start({ listen: true })

  const appConfig = app.getApplication().platformatic.configManager.current
  assert.equal(appConfig.server.pluginTimeout, 60 * 1000)
})
