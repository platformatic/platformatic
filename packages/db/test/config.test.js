import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createFromConfig, getConnectionInfo } from './helper.js'

test('should set pluginTimeout to 60s by default', async t => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo()

  const app = await createFromConfig(t, {
    server: {
      hostname: '127.0.0.1',
      port: 0,
      logger: { level: 'fatal' }
    },
    db: {
      ...connectionInfo
    }
  })

  t.after(async () => {
    await app.stop()
    await dropTestDB()
  })
  await app.start({ listen: true })

  const appConfig = await app.getConfig()
  assert.equal(appConfig.server.pluginTimeout, 60 * 1000)
})

for (const saveDispatch of [undefined, false, true]) {
  test(`should forward db.saveDispatch=${saveDispatch} to the mapper`, async t => {
    const { connectionInfo, dropTestDB } = await getConnectionInfo()

    const app = await createFromConfig(t, {
      server: {
        hostname: '127.0.0.1',
        port: 0,
        logger: { level: 'fatal' }
      },
      db: {
        ...connectionInfo,
        saveDispatch
      }
    })

    t.after(async () => {
      await app.stop()
      await dropTestDB()
    })
    await app.start({ listen: true })

    assert.equal(app.getApplication().platformatic.saveDispatch, saveDispatch === true)
  })
}
