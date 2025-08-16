import assert from 'node:assert/strict'
import { join } from 'node:path'
import { test } from 'node:test'
import { createFromConfig, getConnectionInfo } from '../helper.js'

test('get service config via stackable api', async t => {
  const workingDir = join(import.meta.dirname, '..', 'fixtures', 'directories')
  const { connectionInfo, dropTestDB } = await getConnectionInfo()

  const stackable = await createFromConfig(t, {
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
    await stackable.stop()
    await dropTestDB()
  })
  await stackable.start({ listen: true })

  const stackableConfig = await stackable.getConfig()
  assert.deepStrictEqual(stackableConfig, {
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
