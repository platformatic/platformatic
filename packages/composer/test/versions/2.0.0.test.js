'use strict'

const { test } = require('node:test')
const { equal } = require('node:assert')
const { join } = require('path')
const { configManagerConfig } = require('../../index.js')
const { ConfigManager } = require('@platformatic/config')
const { version } = require('../../package.json')

test('change $schema location', async () => {
  const file = join(__dirname, '..', 'cli', 'fixtures', 'basic', 'platformatic.composer.json')

  const configManager = new ConfigManager({
    ...(configManagerConfig),
    source: file,
    fixPaths: false,
    onMissingEnv (key) {
      return ''
    },
  })

  await configManager.parse()

  const config = configManager.current

  equal(config.$schema, `https://schemas.platformatic.dev/@platformatic/composer/${version}.json`)
})
