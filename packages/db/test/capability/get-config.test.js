import assert from 'node:assert/strict'
import { join } from 'node:path'
import { test } from 'node:test'
import { createFromConfig, getConnectionInfo } from '../helper.js'

test('get application config via capability api', async t => {
  const workingDir = join(import.meta.dirname, '..', 'fixtures', 'directories')
  const { connectionInfo, dropTestDB } = await getConnectionInfo()

  const capability = await createFromConfig(t, {
    server: {
      hostname: '127.0.0.1',
      port: 0,
      logger: { level: 'fatal' }
    },
    db: {
      ...connectionInfo
    },
    plugins: {
      paths: [join(workingDir, 'routes')]
    },
    watch: {
      enabled: false
    }
  })

  t.after(async () => {
    await capability.stop()
    await dropTestDB()
  })
  await capability.start({ listen: true })

  const capabilityConfig = await capability.getConfig()
  assert.deepStrictEqual(capabilityConfig, {
    application: {},
    db: {
      ...connectionInfo
    },
    plugins: {
      paths: [join(workingDir, 'routes')]
    },
    server: {
      hostname: '127.0.0.1',
      port: 0,
      keepAliveTimeout: 5000,
      logger: {
        level: 'fatal'
      },
      pluginTimeout: 60000
    },
    watch: {
      enabled: false
    }
  })
})
