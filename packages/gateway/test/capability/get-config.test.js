import assert from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { createFromConfig } from '../helper.js'

test('get application config via capability api', async t => {
  const config = {
    server: {
      logger: {
        level: 'fatal'
      }
    },
    gateway: {
      applications: []
    },
    plugins: {
      paths: [join(import.meta.dirname, '..', 'openapi', 'fixtures', 'plugins', 'custom.js')]
    }
  }

  const capability = await createFromConfig(t, config)
  t.after(() => capability.stop())
  await capability.start({ listen: true })

  const capabilityConfig = await capability.getConfig()
  assert.deepStrictEqual(capabilityConfig, {
    $schema: 'https://schemas.platformatic.dev/@platformatic/gateway/2.0.0.json',
    application: {},
    gateway: {
      applications: [],
      refreshTimeout: 1000,
      addEmptySchema: false
    },
    plugins: {
      paths: [join(import.meta.dirname, '..', 'openapi', 'fixtures', 'plugins', 'custom.js')]
    },
    server: {
      keepAliveTimeout: 5000,
      logger: {
        level: 'fatal'
      }
    },
    watch: {
      enabled: false
    }
  })
})
