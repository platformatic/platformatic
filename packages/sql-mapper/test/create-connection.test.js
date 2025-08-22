import { deepEqual } from 'node:assert'
import { test } from 'node:test'
import { createConnectionPool } from '../index.js'
import { clear, connInfo, isSQLite } from './helper.js'

const fakeLogger = {
  trace: () => {},
  error: () => {}
}

test('createConnectionPool', async () => {
  const { db, sql } = await createConnectionPool({
    connectionString: connInfo.connectionString,
    log: fakeLogger
  })
  await clear(db, sql)
  test.after(async () => {
    await clear(db, sql)
    db.dispose()
  })
  if (isSQLite) {
    await db.query(sql`CREATE TABLE pages (
        id INTEGER PRIMARY KEY,
        the_title VARCHAR(42),
        is_published BOOLEAN NOT NULL
      );`)
  } else {
    await db.query(sql`CREATE TABLE pages (
        id SERIAL PRIMARY KEY,
        the_title VARCHAR(255) NOT NULL,
        is_published BOOLEAN NOT NULL
      );`)
  }
  await db.query(sql`INSERT INTO pages (the_title, is_published) VALUES ('foo', true)`)

  const res = await db.query(sql`SELECT * FROM pages`)
  deepEqual(res, [
    {
      id: 1,
      the_title: 'foo',
      is_published: true
    }
  ])
})
