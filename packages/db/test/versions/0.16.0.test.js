'use strict'

const { test } = require('node:test')
const { equal, deepEqual } = require('node:assert')
const { join } = require('path')
const { configManagerConfig } = require('../../index.js')
const { upgrade } = require('../../lib/upgrade.js')
const { ConfigManager } = require('@platformatic/config')
const { version } = require('../../package.json')

test('upgrade from v0.16.0', async () => {
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

  deepEqual(config.plugins, {
    paths: ['plugin.js']
  })
})

test('typescript', async () => {
  const configManager = new ConfigManager({
    ...configManagerConfig,
    upgrade,
    source: join(__dirname, '..', 'fixtures', 'versions', 'v0.16.0', 'config-ts.json'),
    version,

    fixPaths: false,
    onMissingEnv (key) {
      return ''
    }
  })

  await configManager.parse()

  const config = configManager.current

  equal(config.$schema, `https://schemas.platformatic.dev/@platformatic/db/${version}.json`)

  deepEqual(config.plugins, {
    paths: ['plugin.ts'],
    typescript: true
  })
})

test('no plugin', async () => {
  const configManager = new ConfigManager({
    ...configManagerConfig,
    upgrade,
    source: join(__dirname, '..', 'fixtures', 'versions', 'v0.16.0', 'no-plugin.db.json'),
    version,

    fixPaths: false,
    onMissingEnv (key) {
      return ''
    }
  })

  await configManager.parse()

  const config = configManager.current

  equal(config.$schema, `https://schemas.platformatic.dev/@platformatic/db/${version}.json`)

  equal(config.plugins, undefined)
})
