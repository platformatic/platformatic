import { loadConfiguration } from '@platformatic/utils'
import { ok } from 'node:assert'
import { resolve } from 'node:path'
import test from 'node:test'
import { transform } from '../../index.js'
import { upgrade } from '../../lib/upgrade.js'

test('remove hotReload', async () => {
  const env = {
    PLT_SERVER_HOSTNAME: 'localhost',
    PORT: '3042',
    PLT_SERVER_LOGGER_LEVEL: 'info'
  }

  const config = await loadConfiguration(
    resolve(import.meta.dirname, '..', 'fixtures', 'versions', 'v2.0.0', 'service.json'),
    null,
    {
      transform,
      upgrade,
      onMissingEnv (key) {
        return env[key]
      }
    }
  )

  ok(typeof config.plugins.typescript === 'undefined')
})
