import { loadConfiguration } from '@platformatic/foundation'
import { equal } from 'node:assert'
import { test } from 'node:test'
import { join } from 'path'
import { transform } from '../../lib/config.js'
import { upgrade } from '../../lib/upgrade.js'
import { version } from '../../lib/version.js'

test('remove the watch config', async () => {
  const config = await loadConfiguration(join(import.meta.dirname, 'fixtures', '1.4.0.json'), null, {
    transform,
    upgrade
  })

  equal(config.$schema, `https://schemas.platformatic.dev/@platformatic/runtime/${version}.json`)
  equal(config.watch, true)
})
