'use strict'

const { test } = require('node:test')
const { equal } = require('node:assert')
const { join } = require('path')
const { platformaticRuntime } = require('../../index.js')
const { ConfigManager } = require('@platformatic/config')
const { version } = require('../../package.json')

test('remove the watch config', async () => {
  const file = join(__dirname, 'fixtures', '1.4.0.json')

  const configManager = new ConfigManager({
    ...platformaticRuntime.configManagerConfig,
    source: file,
    fixPaths: true,
    onMissingEnv (key) {
      return ''
    },
  })

  await configManager.parse()

  const config = configManager.current

  equal(config.$schema, `https://schemas.platformatic.dev/@platformatic/runtime/${version}.json`)
  equal(config.watch, true)
})
