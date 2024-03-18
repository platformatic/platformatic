'use strict'

const { test } = require('node:test')
const { equal, deepEqual } = require('node:assert')
const { join } = require('path')
const { platformaticService } = require('../../index.js')
const { ConfigManager } = require('@platformatic/config')
const { version } = require('../../package.json')

test('upgrade from v0.16.0', async () => {
  const file = join(__dirname, '..', 'fixtures', 'versions', 'v0.16.0', 'platformatic.service.json')

  const configManager = new ConfigManager({
    ...(platformaticService.configManagerConfig),
    source: file,
    fixPaths: false,
    onMissingEnv (key) {
      return ''
    }
  })

  await configManager.parse()

  const config = configManager.current

  equal(config.$schema, `https://platformatic.dev/schemas/v${version}/service`)

  deepEqual(config.plugins, {
    paths: ['plugin.js']
  })
})

test('array of plugins', async () => {
  const file = join(__dirname, '..', 'fixtures', 'versions', 'v0.16.0', 'array.service.json')

  const configManager = new ConfigManager({
    ...(platformaticService.configManagerConfig),
    source: file,
    fixPaths: false,
    onMissingEnv (key) {
      return ''
    }
  })

  await configManager.parse()

  const config = configManager.current

  equal(config.$schema, `https://platformatic.dev/schemas/v${version}/service`)

  deepEqual(config.plugins, {
    paths: ['./plugins/index.js', './routes/']
  })
})

test('array of plugins (strings)', async () => {
  const file = join(__dirname, '..', 'fixtures', 'versions', 'v0.16.0', 'array-string.service.json')

  const configManager = new ConfigManager({
    ...(platformaticService.configManagerConfig),
    source: file,
    fixPaths: false,
    onMissingEnv (key) {
      return ''
    }
  })

  await configManager.parse()

  const config = configManager.current

  equal(config.$schema, `https://platformatic.dev/schemas/v${version}/service`)

  deepEqual(config.plugins, {
    paths: ['./plugins/index.js', './routes/']
  })
  equal(config.plugin, undefined)
})

test('single string', async () => {
  const file = join(__dirname, '..', 'fixtures', 'versions', 'v0.16.0', 'single-string.service.json')

  const configManager = new ConfigManager({
    ...(platformaticService.configManagerConfig),
    source: file,
    fixPaths: false,
    onMissingEnv (key) {
      return ''
    }
  })

  await configManager.parse()

  const config = configManager.current

  deepEqual(config.plugins, {
    paths: ['plugin.js']
  })
  equal(config.plugin, undefined)
})

test('plugin options', async () => {
  const file = join(__dirname, '..', 'fixtures', 'versions', 'v0.16.0', 'options.service.json')

  const configManager = new ConfigManager({
    ...(platformaticService.configManagerConfig),
    source: file,
    fixPaths: false,
    onMissingEnv (key) {
      return ''
    }
  })

  await configManager.parse()

  const config = configManager.current

  deepEqual(config.plugins, {
    paths: [{
      path: 'plugin.js',
      options: {
        something: 'else'
      }
    }],
    stopTimeout: 10000
  })
  equal(config.plugin, undefined)
})

test('plugin options (array)', async () => {
  const file = join(__dirname, '..', 'fixtures', 'versions', 'v0.16.0', 'options-array.service.json')

  const configManager = new ConfigManager({
    ...(platformaticService.configManagerConfig),
    source: file,
    fixPaths: false,
    onMissingEnv (key) {
      return ''
    }
  })

  await configManager.parse()

  const config = configManager.current

  deepEqual(config.plugins, {
    paths: [{
      path: 'plugin.ts',
      options: {
        something: 'else'
      }
    }, {
      path: 'other.js',
      options: {
        foo: 'bar'
      }
    }],
    stopTimeout: 10000,
    typescript: true
  })
  equal(config.plugin, undefined)
})

test('yaml loading', async () => {
  const file = join(__dirname, '..', 'fixtures', 'versions', 'v0.16.0', 'single-string.service.yaml')

  const configManager = new ConfigManager({
    ...(platformaticService.configManagerConfig),
    source: file,
    fixPaths: false,
    onMissingEnv (key) {
      return ''
    }
  })

  await configManager.parse()

  const config = configManager.current

  deepEqual(config.plugins, {
    paths: ['plugin.js']
  })
  equal(config.plugin, undefined)
})
