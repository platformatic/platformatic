import assert from 'node:assert/strict'
import { join } from 'node:path'
import { test } from 'node:test'
import { version as pltVersion } from '../../lib/schema.js'
import { createFromConfig, getConnectionInfo } from '../helper.js'

test('get application info via capability api', async t => {
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
    watch: false
  })

  t.after(async () => {
    await capability.stop()
    await dropTestDB()
  })
  await capability.start({ listen: true })

  const capabilityInfo = await capability.getInfo()
  assert.deepStrictEqual(capabilityInfo, {
    type: 'db',
    version: pltVersion
  })
})
