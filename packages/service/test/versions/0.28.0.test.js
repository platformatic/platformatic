import { loadConfiguration } from '@platformatic/foundation'
import { deepEqual, equal } from 'node:assert'
import { resolve } from 'node:path'
import test from 'node:test'
import { transform } from '../../index.js'
import { version } from '../../lib/schema.js'
import { upgrade } from '../../lib/upgrade.js'

test('remove hotReload', async () => {
  const env = {
    PLT_SERVER_HOSTNAME: 'localhost',
    PORT: '3042',
    PLT_SERVER_LOGGER_LEVEL: 'info'
  }

  const config = await loadConfiguration(
    resolve(import.meta.dirname, '..', 'fixtures', 'versions', 'v0.27.0', 'service.json'),
    null,
    {
      transform,
      upgrade,
      onMissingEnv (key) {
        return env[key]
      }
    }
  )

  equal(config.$schema, `https://schemas.platformatic.dev/@platformatic/service/${version}.json`)

  deepEqual(config.plugins, {
    paths: ['plugin.js']
  })

  deepEqual(config.watch, { enabled: true })
})
