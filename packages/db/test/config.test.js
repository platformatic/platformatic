'use strict'

const { connInfo, buildConfig } = require('./helper')
const { test } = require('tap')
const { buildServer } = require('..')

test('should set pluginTimeout to 60s by default', async ({ teardown, equal }) => {
  const config = {
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    db: {
      ...connInfo
    }
  }

  const app = await buildServer(buildConfig(config))

  teardown(async () => {
    await app.close()
  })
  await app.start()

  const appConfig = app.platformatic.configManager.current
  equal(appConfig.server.pluginTimeout, 60 * 1000)
})
