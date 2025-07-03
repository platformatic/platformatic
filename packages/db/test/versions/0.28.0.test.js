'use strict'

const { test } = require('node:test')
const { equal, deepEqual } = require('node:assert')
const { join } = require('path')
const { configManagerConfig } = require('../../index.js')
const { upgrade } = require('../../lib/upgrade.js')
const { ConfigManager } = require('@platformatic/config')
const { version } = require('../../package.json')

test('remove hotReload', async () => {
  const configManager = new ConfigManager({
    ...configManagerConfig,
    upgrade,
    source: join(__dirname, '..', 'fixtures', 'versions', 'v0.16.0', 'platformatic.db.json'),
    version,
    fixPaths: false,
    onMissingEnv (key) {
      return ''
    }
  })

  await configManager.parse()

  const config = configManager.current

  equal(config.$schema, `https://schemas.platformatic.dev/@platformatic/db/${version}.json`)

  deepEqual(config.watch, {
    ignore: ['*.sqlite', '*.sqlite-journal']
  })
})
