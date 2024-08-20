'use strict'

const assert = require('node:assert/strict')
const { test } = require('node:test')
const { join } = require('node:path')
const { buildConfigManager, getConnectionInfo, createBasicPages } = require('../helper')
const { buildStackable } = require('../..')

test('get DB info via stackable api', async (t) => {
  const workingDir = join(__dirname, '..', 'fixtures', 'directories')
  const { connectionInfo, dropTestDB } = await getConnectionInfo()
  const { dbname } = connectionInfo

  const config = {
    server: {
      hostname: '127.0.0.1',
      port: 0,
    },
    db: {
      ...connectionInfo,
      async onDatabaseLoad (db, sql) {
        await createBasicPages(db, sql)
      },
    },
    plugins: {
      paths: [join(workingDir, 'routes')],
    },
    watch: false,
    metrics: false,
  }

  const configManager = await buildConfigManager(config, workingDir)
  const stackable = await buildStackable({ configManager })

  t.after(async () => {
    await stackable.stop()
    await dropTestDB()
  })
  await stackable.start()

  const stackableDBInfo = await stackable.getDBInfo()

  assert.deepStrictEqual(stackableDBInfo.connectionInfo, {
    database: dbname,
    dbSystem: 'postgresql',
    host: '127.0.0.1',
    port: 5432,
    user: 'postgres',
    isPg: true,
    isMySql: undefined,
    isSQLite: undefined,
  })

  const tables = []
  for (const tableInfo of stackableDBInfo.dbschema) {
    tables.push(tableInfo.table)
  }
  assert.deepStrictEqual(tables, ['pages'])
})
