'use strict'

const { test } = require('tap')

const { clear, connInfo, isMysql8 } = require('./helper')
const { connect } = require('..')
const fakeLogger = {
  trace: () => {},
  warn: () => {},
  error: () => {}
}

test('no key', async ({ same, teardown, pass, equal, plan }) => {
  plan(3)
  async function onDatabaseLoad (db, sql) {
    await clear(db, sql)
    teardown(() => db.dispose())

    const table = sql`
      CREATE TABLE pages (
        xx INTEGER DEFAULT NULL,
        name varchar(75) DEFAULT NULL
      );
    `

    await db.query(table)
  }
  const log = {
    trace: () => {},
    warn: (obj, str) => {
      same(obj, { table: 'pages' })
      equal(str, 'Cannot find any primary keys for table')
    },
    error: () => {}
  }
  const mapper = await connect({
    connectionString: connInfo.connectionString,
    log,
    onDatabaseLoad
  })
  same(mapper.entities, {})
})
