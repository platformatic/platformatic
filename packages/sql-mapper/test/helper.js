import { connect, dropAllTables } from '../index.js'

// Needed to work with dates & postgresql
// See https://node-postgres.com/features/types/
process.env.TZ = 'UTC'

export const connInfo = {
  autoTimestamp: {
    createdAt: 'inserted_at',
    updatedAt: 'updated_at'
  }
}

export let isPg = false
export let isMysql = false
export let isMysql8 = false
export let isSQLite = false
export let expectedTelemetryPrefix = 'pg'
export let expectedPort = 5432

if (!process.env.DB || process.env.DB === 'postgresql') {
  connInfo.connectionString = 'postgres://postgres:postgres@127.0.0.1/postgres'
  isPg = true
  expectedTelemetryPrefix = 'pg'
  expectedPort = 5432
} else if (process.env.DB === 'mariadb') {
  connInfo.connectionString = 'mysql://root@127.0.0.1:3307/graph'
  connInfo.poolSize = 10
  isMysql = true
  expectedTelemetryPrefix = 'mysql'
  expectedPort = 3307
} else if (process.env.DB === 'mysql') {
  connInfo.connectionString = 'mysql://root@127.0.0.1/graph'
  connInfo.poolSize = 10
  isMysql = true
  expectedTelemetryPrefix = 'mysql'
  expectedPort = 3306
} else if (process.env.DB === 'mysql8') {
  connInfo.connectionString = 'mysql://root@127.0.0.1:3308/graph'
  connInfo.poolSize = 10
  isMysql = true
  isMysql8 = true
  expectedTelemetryPrefix = 'mysql'
  expectedPort = 3308
} else if (process.env.DB === 'sqlite') {
  connInfo.connectionString = 'sqlite://:memory:'
  isSQLite = true
  expectedTelemetryPrefix = 'sqlite'
}

export async function clear (db, sql) {
  await dropAllTables(db, sql)
  await dropAllTables(db, sql, ['test1', 'test2'])
}

const fakeLogger = {
  trace: () => {},
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  fatal: () => {}
}

export async function setupDatabase ({ seed, cache, t }) {
  return connect({
    connectionString: connInfo.connectionString,
    log: fakeLogger,
    onDatabaseLoad: async (db, sql) => {
      t.after(() => db.dispose())

      for (const query of seed) {
        await db.query(sql(query))
      }
    },
    ignore: {},
    hooks: {},
    cache
  })
}

export async function createBasicPages (db, sql) {
  if (isSQLite) {
    await db.query(sql`CREATE TABLE pages (
      id INTEGER PRIMARY KEY,
      title VARCHAR(42)
    );`)
    await db.query(sql`CREATE TABLE categories (
      id INTEGER PRIMARY KEY,
      name VARCHAR(42)
    );`)
  } else {
    await db.query(sql`CREATE TABLE pages (
      id SERIAL PRIMARY KEY,
      title VARCHAR(42)
    );`)
    await db.query(sql`CREATE TABLE categories (
      id SERIAL PRIMARY KEY,
      name VARCHAR(42)
    );`)
  }
}
