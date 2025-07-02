'use strict'

const { test } = require('node:test')
const { equal, deepEqual } = require('node:assert')
const { join } = require('path')
const { configManagerConfig } = require('../../index.js')
const { upgrade } = require('../../lib/upgrade.js')
const { ConfigManager } = require('@platformatic/config')
const { version } = require('../../package.json')

test('remove hotReload', async () => {
  const env = {
    PLT_SERVER_HOSTNAME: 'localhost',
    PORT: '3042',
    PLT_SERVER_LOGGER_LEVEL: 'info'
  }

  const configManager = new ConfigManager({
    ...configManagerConfig,
    upgrade,
    source: join(__dirname, '..', 'fixtures', 'versions', 'v0.27.0', 'service.json'),
    version,
    fixPaths: false,
    onMissingEnv (key) {
      return env[key]
    }
  })

  await configManager.parse()

  const config = configManager.current

  equal(config.$schema, `https://schemas.platformatic.dev/@platformatic/service/${version}.json`)

  deepEqual(config.plugins, {
    paths: ['plugin.js']
  })

  deepEqual(config.watch, { enabled: true })
})
