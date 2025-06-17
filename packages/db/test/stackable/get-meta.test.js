'use strict'

const assert = require('node:assert/strict')
const { test } = require('node:test')
const { join } = require('node:path')
const { buildConfigManager, getConnectionInfo, createBasicPages } = require('../helper')
const { buildStackable } = require('../..')

test('get meta info via stackable api', async t => {
  const workingDir = join(__dirname, '..', 'fixtures', 'directories')
  const { connectionInfo, dropTestDB } = await getConnectionInfo()
  const { dbname } = connectionInfo

  const config = {
    server: {
      hostname: '127.0.0.1',
      port: 3245
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
    watch: false,
    metrics: false
  }

  const configManager = await buildConfigManager(config, workingDir)
  const stackable = await buildStackable({ configManager })

  t.after(async () => {
    await stackable.stop()
    await dropTestDB()
  })
  await stackable.start()

  const meta = await stackable.getMeta()
  const expected = {
    composer: {
      needsRootTrailingSlash: false,
      prefix: undefined,
      wantsAbsoluteUrls: false,
      tcp: true,
      url: 'http://127.0.0.1:3245',
    },
    connectionStrings: [`postgres://postgres:postgres@127.0.0.1/${dbname}`]
  }

  assert.deepStrictEqual(meta, expected)
})
