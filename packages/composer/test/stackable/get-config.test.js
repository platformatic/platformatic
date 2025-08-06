import assert from 'node:assert'
import { join } from 'node:path'
import { test } from 'node:test'
import { createFromConfig } from '../helper.js'

test('get service config via stackable api', async t => {
  const config = {
    server: {
      logger: {
        level: 'fatal'
      }
    },
    composer: {
      services: []
    },
    plugins: {
      paths: [join(import.meta.dirname, '..', 'openapi', 'fixtures', 'plugins', 'custom.js')]
    }
  }

  const stackable = await createFromConfig(t, config)
  t.after(() => stackable.stop())
  await stackable.start({ listen: true })

  const stackableConfig = await stackable.getConfig()
  assert.deepStrictEqual(stackableConfig, {
    application: {},
    composer: {
      services: [],
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
