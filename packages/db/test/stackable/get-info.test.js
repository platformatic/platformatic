import assert from 'node:assert/strict'
import { join } from 'node:path'
import { test } from 'node:test'
import { version as pltVersion } from '../../lib/schema.js'
import { createFromConfig, getConnectionInfo } from '../helper.js'

test('get service info via stackable api', async t => {
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
    watch: false
  })

  t.after(async () => {
    await stackable.stop()
    await dropTestDB()
  })
  await stackable.start({ listen: true })

  const stackableInfo = await stackable.getInfo()
  assert.deepStrictEqual(stackableInfo, {
    type: 'db',
    version: pltVersion
  })
})
