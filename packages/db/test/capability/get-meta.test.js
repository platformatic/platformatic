import assert from 'node:assert/strict'
import { join } from 'node:path'
import test from 'node:test'
import { createBasicPages, createFromConfig, getConnectionInfo } from '../helper.js'

test('get meta info via capability api', async t => {
  const workingDir = join(import.meta.dirname, '..', 'fixtures', 'directories')
  const { connectionInfo, dropTestDB } = await getConnectionInfo()
  const { dbname } = connectionInfo

  const capability = await createFromConfig(t, {
    server: {
      hostname: '127.0.0.1',
      port: 3245,
      logger: { level: 'fatal' }
    },
    db: {
      ...connectionInfo,
      async onDatabaseLoad (db, sql) {
        await createBasicPages(db, sql)
      }
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

  const meta = await capability.getMeta()
  const expected = {
    gateway: {
      needsRootTrailingSlash: false,
      prefix: '/',
      wantsAbsoluteUrls: false,
      tcp: true,
      url: 'http://127.0.0.1:3245'
    },
    connectionStrings: [`postgres://postgres:postgres@127.0.0.1/${dbname}`]
  }

  assert.deepStrictEqual(meta, expected)
})
