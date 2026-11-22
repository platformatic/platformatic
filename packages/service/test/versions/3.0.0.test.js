import { loadConfiguration } from '@platformatic/foundation'
import { ok } from 'node:assert'
import { resolve } from 'node:path'
import test from 'node:test'
import { transform } from '../../index.js'
import { upgrade } from '../../lib/upgrade.js'

test('remove hotReload', async () => {
  const config = await loadConfiguration(
    resolve(import.meta.dirname, '..', 'fixtures', 'versions', 'v2.0.0', 'service.json'),
    null,
    {
      transform,
      upgrade
    }
  )

  ok(typeof config.plugins.typescript === 'undefined')
})
