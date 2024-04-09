'use strict'

const { test } = require('node:test')
const { equal } = require('node:assert')
const { join } = require('path')
const { platformaticRuntime } = require('../../index.js')
const { ConfigManager } = require('@platformatic/config')
const { version } = require('../../package.json')

test('rmeove the watch config', async () => {
  const file = join(__dirname, 'fixtures', '1.4.0.json')

  const configManager = new ConfigManager({
    ...(platformaticRuntime.configManagerConfig),
    source: file,
    fixPaths: true,
    onMissingEnv (key) {
      return ''
    }
  })

  await configManager.parse()

  const config = configManager.current

  equal(config.$schema, `https://platformatic.dev/schemas/v${version}/runtime`)
  equal(config.watch, undefined)
})
