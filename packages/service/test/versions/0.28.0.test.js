'use strict'

const { test } = require('node:test')
const { equal, deepEqual } = require('node:assert')
const { join } = require('path')
const { platformaticService } = require('../../index.js')
const { ConfigManager } = require('@platformatic/config')
const { version } = require('../../package.json')

test('remove hotReload', async () => {
  const file = join(__dirname, '..', 'fixtures', 'versions', 'v0.27.0', 'service.json')

  const configManager = new ConfigManager({
    ...(platformaticService.configManagerConfig),
    source: file,
    fixPaths: false,
    onMissingEnv (key) {
      return ''
    },
  })

  await configManager.parse()

  const config = configManager.current

  equal(config.$schema, `https://platformatic.dev/schemas/v${version}/service`)

  deepEqual(config.plugins, {
    paths: ['plugin.js'],
  })

  deepEqual(config.watch, {})
})
