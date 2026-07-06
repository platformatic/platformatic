import { deepEqual, equal, match, rejects } from 'node:assert'
import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
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

test('friendly error when the SQLite directory does not exist', { skip: !isSQLite }, async () => {
  await rejects(
    createConnectionPool({
      connectionString: 'sqlite:///this/directory/does/not/exist/db.sqlite',
      log: fakeLogger
    }),
    err => {
      equal(err.code, 'PLT_SQL_MAPPER_CANNOT_ACCESS_DATABASE_FILE')
      match(err.message, /the directory "\/this\/directory\/does\/not\/exist" does not exist/)
      return true
    }
  )
})

test('friendly error when the SQLite file is not readable', { skip: !isSQLite || process.getuid() === 0 }, async () => {
  const dir = await mkdtemp(join(tmpdir(), 'plt-sql-mapper-'))
  const file = join(dir, 'db.sqlite')
  await writeFile(file, '')
  await chmod(file, 0o000)
  test.after(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  await rejects(
    createConnectionPool({
      connectionString: `sqlite://${file}`,
      log: fakeLogger
    }),
    err => {
      equal(err.code, 'PLT_SQL_MAPPER_CANNOT_ACCESS_DATABASE_FILE')
      match(err.message, /the file is not readable by the current user/)
      return true
    }
  )
})

test('the SQLite database file is created when the directory is writable', { skip: !isSQLite }, async () => {
  const dir = await mkdtemp(join(tmpdir(), 'plt-sql-mapper-'))
  const file = join(dir, 'db.sqlite')
  const { db, sql } = await createConnectionPool({
    connectionString: `sqlite://${file}`,
    log: fakeLogger
  })
  test.after(async () => {
    await db.dispose()
    await rm(dir, { recursive: true, force: true })
  })

  const res = await db.query(sql`SELECT 1 as one`)
  deepEqual(res, [{ one: 1 }])
})
