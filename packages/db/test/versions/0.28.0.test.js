import { loadConfiguration } from '@platformatic/utils'
import { deepEqual, equal } from 'node:assert'
import test from 'node:test'
import { join } from 'path'
import { transform } from '../../index.js'
import { version } from '../../lib/schema.js'
import { upgrade } from '../../lib/upgrade.js'

test('remove hotReload', async () => {
  const config = await loadConfiguration(
    join(import.meta.dirname, '..', 'fixtures', 'versions', 'v0.16.0', 'platformatic.db.json'),
    null,
    {
      transform,
      upgrade
    }
  )

  equal(config.$schema, `https://schemas.platformatic.dev/@platformatic/db/${version}.json`)

  deepEqual(config.watch, {
    ignore: ['*.sqlite', '*.sqlite-journal']
  })
})
