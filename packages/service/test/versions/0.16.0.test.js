import { loadConfiguration } from '@platformatic/foundation'
import { deepEqual, equal } from 'node:assert'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { transform } from '../../index.js'
import { version } from '../../lib/schema.js'
import { upgrade } from '../../lib/upgrade.js'

test('upgrade from v0.16.0', async () => {
  const config = await loadConfiguration(
    resolve(import.meta.dirname, '..', 'fixtures', 'versions', 'v0.16.0', 'platformatic.service.json'),
    null,
    { transform, upgrade }
  )

  equal(config.$schema, `https://schemas.platformatic.dev/@platformatic/service/${version}.json`)

  deepEqual(config.plugins, {
    paths: ['plugin.js']
  })
})

test('array of plugins', async () => {
  const config = await loadConfiguration(
    resolve(import.meta.dirname, '..', 'fixtures', 'versions', 'v0.16.0', 'array.service.json'),
    null,
    { transform, upgrade }
  )

  equal(config.$schema, `https://schemas.platformatic.dev/@platformatic/service/${version}.json`)

  deepEqual(config.plugins, {
    paths: ['./plugins/index.js', './routes/']
  })
})

test('array of plugins (strings)', async () => {
  const config = await loadConfiguration(
    resolve(import.meta.dirname, '..', 'fixtures', 'versions', 'v0.16.0', 'array-string.service.json'),
    null,
    { transform, upgrade }
  )

  equal(config.$schema, `https://schemas.platformatic.dev/@platformatic/service/${version}.json`)

  deepEqual(config.plugins, {
    paths: ['./plugins/index.js', './routes/']
  })
  equal(config.plugin, undefined)
})

test('single string', async () => {
  const config = await loadConfiguration(
    resolve(import.meta.dirname, '..', 'fixtures', 'versions', 'v0.16.0', 'single-string.service.json'),
    null,
    { transform, upgrade }
  )

  deepEqual(config.plugins, {
    paths: ['plugin.js']
  })
  equal(config.plugin, undefined)
})

test('plugin options', async () => {
  const config = await loadConfiguration(
    resolve(import.meta.dirname, '..', 'fixtures', 'versions', 'v0.16.0', 'options.service.json'),
    null,
    { transform, upgrade }
  )

  deepEqual(config.plugins, {
    paths: [
      {
        path: 'plugin.js',
        options: {
          something: 'else'
        }
      }
    ],
    stopTimeout: 10000
  })
  equal(config.plugin, undefined)
})

test('plugin options (array)', async () => {
  const config = await loadConfiguration(
    resolve(import.meta.dirname, '..', 'fixtures', 'versions', 'v0.16.0', 'options-array.service.json'),
    null,
    { transform, upgrade }
  )

  deepEqual(config.plugins, {
    paths: [
      {
        path: 'plugin.ts',
        options: {
          something: 'else'
        }
      },
      {
        path: 'other.js',
        options: {
          foo: 'bar'
        }
      }
    ],
    stopTimeout: 10000
  })
  equal(config.plugin, undefined)
})

test('yaml loading', async () => {
  const config = await loadConfiguration(
    resolve(import.meta.dirname, '..', 'fixtures', 'versions', 'v0.16.0', 'single-string.service.yaml'),
    null,
    { transform, upgrade }
  )

  deepEqual(config.plugins, {
    paths: ['plugin.js']
  })
  equal(config.plugin, undefined)
})
