'use strict'

const { test } = require('tap')

const { clear, connInfo, isMysql8 } = require('./helper')
const { connect } = require('..')
const fakeLogger = {
  trace: () => {},
  error: () => {}
}

test('unique key', async ({ equal, not, same, teardown }) => {
  async function onDatabaseLoad (db, sql) {
    await clear(db, sql)
    teardown(() => db.dispose())

    const table = sql`
      CREATE TABLE pages (
        xx INTEGER DEFAULT NULL UNIQUE,
        name varchar(75) DEFAULT NULL UNIQUE
      );
    `

    await db.query(table)
  }
  const mapper = await connect({
    connectionString: connInfo.connectionString,
    log: fakeLogger,
    onDatabaseLoad,
    ignore: {},
    hooks: {}
  })
  const pageEntity = mapper.entities.page
  not(pageEntity, undefined)
  equal(pageEntity.name, 'Page')
  equal(pageEntity.singularName, 'page')
  equal(pageEntity.pluralName, 'pages')
  if (isMysql8) {
    same(pageEntity.primaryKeys, new Set(['name']))
    equal(pageEntity.camelCasedFields.name.primaryKey, true)
  } else {
    same(pageEntity.primaryKeys, new Set(['xx']))
    equal(pageEntity.camelCasedFields.xx.primaryKey, true)
  }
})
