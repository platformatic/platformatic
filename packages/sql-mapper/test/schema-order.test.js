import { deepEqual } from 'node:assert'
import { test } from 'node:test'
import { connect } from '../index.js'
import { clear, connInfo, isSQLite } from './helper.js'

const fakeLogger = {
  trace: () => {},
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  fatal: () => {}
}

// Introspection must be deterministic so that generated artifacts derived from
// dbschema (schema.lock, the OpenAPI paths and, downstream, generated clients)
// do not churn between regenerations. Tables are created out of alphabetical
// order on purpose; the introspected dbschema must come back sorted regardless.
test('introspection is deterministically ordered', async () => {
  async function onDatabaseLoad (db, sql) {
    await clear(db, sql)
    test.after(async () => {
      await clear(db, sql)
      db.dispose()
    })

    const pk = isSQLite ? sql`INTEGER PRIMARY KEY` : sql`SERIAL PRIMARY KEY`

    // Deliberately created out of alphabetical order, with columns whose names
    // do NOT match their definition order, so the test distinguishes
    // "sorted by name" (tables) from "kept in ordinal order" (columns).
    await db.query(sql`CREATE TABLE zebra ( id ${pk}, gamma VARCHAR(42), alpha VARCHAR(42), beta VARCHAR(42) )`)
    await db.query(sql`CREATE TABLE apple ( id ${pk} )`)
    await db.query(sql`CREATE TABLE mango ( id ${pk} )`)
  }

  const mapper = await connect({
    connectionString: connInfo.connectionString,
    log: fakeLogger,
    onDatabaseLoad,
    ignore: {},
    hooks: {}
  })

  // Tables are ordered alphabetically by name, not by creation order.
  const tableNames = mapper.dbschema.map(t => t.table)
  deepEqual(tableNames, ['apple', 'mango', 'zebra'])

  // Columns stay in their definition (ordinal) order, not sorted by name.
  const zebra = mapper.dbschema.find(t => t.table === 'zebra')
  deepEqual(
    zebra.columns.map(c => c.column_name),
    ['id', 'gamma', 'alpha', 'beta']
  )
})
