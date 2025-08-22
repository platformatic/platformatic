import { loadConfiguration } from '@platformatic/foundation'
import { deepStrictEqual } from 'node:assert'
import { test } from 'node:test'
import { join } from 'path'
import { transform } from '../../lib/config.js'
import { upgrade } from '../../lib/upgrade.js'

test('gracefulShutdown service to application rename', async () => {
  const config = await loadConfiguration(join(import.meta.dirname, 'fixtures', '2.0.0.json'), null, {
    transform,
    upgrade
  })

  deepStrictEqual(config.gracefulShutdown, { runtime: 1000, application: 1000 })
  deepStrictEqual(config.applicationTimeout, 1234)
})
