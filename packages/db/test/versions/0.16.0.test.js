'use strict'

const { test } = require('node:test')
const { equal, deepEqual } = require('node:assert')
const { join } = require('path')
const { platformaticDB } = require('../../index.js')
const { ConfigManager } = require('@platformatic/config')
const { version } = require('../../package.json')

test('upgrade from v0.16.0', async () => {
  const file = join(__dirname, '..', 'fixtures', 'versions', 'v0.16.0', 'platformatic.db.json')

  const configManager = new ConfigManager({
    ...(platformaticDB.configManagerConfig),
    source: file,
    fixPaths: false,
    onMissingEnv (key) {
      return ''
    },
  })

  await configManager.parse()

  const config = configManager.current

  equal(config.$schema, `https://schemas.platformatic.dev/@platformatic/db/${version}.json`)

  deepEqual(config.plugins, {
    paths: ['plugin.js'],
  })
})

test('typescript', async () => {
  const file = join(__dirname, '..', 'fixtures', 'versions', 'v0.16.0', 'config-ts.json')

  const configManager = new ConfigManager({
    ...(platformaticDB.configManagerConfig),
    source: file,
    fixPaths: false,
    onMissingEnv (key) {
      return ''
    },
  })

  await configManager.parse()

  const config = configManager.current

  equal(config.$schema, `https://schemas.platformatic.dev/@platformatic/db/${version}.json`)

  deepEqual(config.plugins, {
    paths: ['plugin.ts'],
    typescript: true,
  })
})

test('no plugin', async () => {
  const file = join(__dirname, '..', 'fixtures', 'versions', 'v0.16.0', 'no-plugin.db.json')

  const configManager = new ConfigManager({
    ...(platformaticDB.configManagerConfig),
    source: file,
    fixPaths: false,
    onMissingEnv (key) {
      return ''
    },
  })

  await configManager.parse()

  const config = configManager.current

  equal(config.$schema, `https://schemas.platformatic.dev/@platformatic/db/${version}.json`)

  equal(config.plugins, undefined)
})
