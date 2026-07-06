import { deepEqual } from 'node:assert'
import { test } from 'node:test'
import { connect } from '../index.js'
import { clear, connInfo, isSQLite } from './helper.js'

const fakeLogger = {
  trace: () => {},
  error: () => {}
}

test('tables and views are introspected in a deterministic order', async () => {
  async function onDatabaseLoad (db, sql) {
    await clear(db, sql)
    test.after(async () => {
      await db.query(sql`DROP VIEW IF EXISTS zzz_view`)
      await db.query(sql`DROP VIEW IF EXISTS aaa_view`)
      await db.query(sql`DROP TABLE IF EXISTS zzz`)
      await db.query(sql`DROP TABLE IF EXISTS mmm`)
      await db.query(sql`DROP TABLE IF EXISTS aaa`)
      db.dispose()
    })

    // Created on purpose in non-alphabetical order
    if (isSQLite) {
      await db.query(sql`CREATE TABLE zzz (id INTEGER PRIMARY KEY, title VARCHAR(42))`)
      await db.query(sql`CREATE TABLE mmm (id INTEGER PRIMARY KEY, title VARCHAR(42))`)
      await db.query(sql`CREATE TABLE aaa (id INTEGER PRIMARY KEY, title VARCHAR(42))`)
    } else {
      await db.query(sql`CREATE TABLE zzz (id SERIAL PRIMARY KEY, title VARCHAR(42))`)
      await db.query(sql`CREATE TABLE mmm (id SERIAL PRIMARY KEY, title VARCHAR(42))`)
      await db.query(sql`CREATE TABLE aaa (id SERIAL PRIMARY KEY, title VARCHAR(42))`)
    }
    await db.query(sql`CREATE VIEW zzz_view AS SELECT id, title FROM zzz`)
    await db.query(sql`CREATE VIEW aaa_view AS SELECT id, title FROM aaa`)
  }
  const mapper = await connect({
    connectionString: connInfo.connectionString,
    log: fakeLogger,
    onDatabaseLoad,
    ignore: {},
    hooks: {},
    include: {
      aaa: true,
      mmm: true,
      zzz: true,
      aaa_view: true,
      zzz_view: true
    }
  })

  const tables = mapper.dbschema.filter(t => !t.isView).map(t => t.table)
  deepEqual(tables, ['aaa', 'mmm', 'zzz'])

  const views = mapper.dbschema.filter(t => t.isView).map(t => t.table)
  deepEqual(views, ['aaa_view', 'zzz_view'])

  // Columns must follow the table definition order
  const zzz = mapper.dbschema.find(t => t.table === 'zzz')
  deepEqual(
    zzz.columns.map(c => c.column_name),
    ['id', 'title']
  )
})
