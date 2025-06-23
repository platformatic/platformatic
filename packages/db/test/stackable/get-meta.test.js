'use strict'

const assert = require('node:assert/strict')
const { test } = require('node:test')
const { join } = require('node:path')
const { createStackableFromConfig, getConnectionInfo, createBasicPages } = require('../helper')

test('get meta info via stackable api', async t => {
  const workingDir = join(__dirname, '..', 'fixtures', 'directories')
  const { connectionInfo, dropTestDB } = await getConnectionInfo()
  const { dbname } = connectionInfo

  const stackable = await createStackableFromConfig(t, {
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
    watch: false,
    metrics: false
  })

  t.after(async () => {
    await stackable.stop()
    await dropTestDB()
  })
  await stackable.start({ listen: true })

  const meta = await stackable.getMeta()
  const expected = {
    composer: {
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
