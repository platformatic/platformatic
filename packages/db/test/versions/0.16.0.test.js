import { loadConfiguration } from '@platformatic/utils'
import { deepEqual, equal } from 'node:assert'
import test from 'node:test'
import { join } from 'path'
import { transform } from '../../index.js'
import { version } from '../../lib/schema.js'
import { upgrade } from '../../lib/upgrade.js'

test('upgrade from v0.16.0', async () => {
  const config = await loadConfiguration(
    join(import.meta.dirname, '..', 'fixtures', 'versions', 'v0.16.0', 'platformatic.db.json'),
    null,
    {
      transform,
      upgrade
    }
  )

  equal(config.$schema, `https://schemas.platformatic.dev/@platformatic/db/${version}.json`)

  deepEqual(config.plugins, {
    paths: ['plugin.js']
  })
})

test('no plugin', async () => {
  const config = await loadConfiguration(
    join(import.meta.dirname, '..', 'fixtures', 'versions', 'v0.16.0', 'no-plugin.db.json'),
    null,
    {
      transform,
      upgrade
    }
  )

  equal(config.$schema, `https://schemas.platformatic.dev/@platformatic/db/${version}.json`)

  equal(config.plugins, undefined)
})
