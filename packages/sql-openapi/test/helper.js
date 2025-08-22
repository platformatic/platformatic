import { dropAllTables } from '@platformatic/sql-mapper'
import why from 'why-is-node-running'

if (process.env.WHY === 'true') {
  setInterval(() => {
    console.log('why is node running?')
    why()
  }, 60000).unref()
}
// Needed to work with dates & postgresql
// See https://node-postgres.com/features/types/
process.env.TZ = 'UTC'

export const connInfo = {}
export let isPg = false
export let isMysql = false
export let isMariaDB = false
export let isMysql8 = false
export let isSQLite = false

if (!process.env.DB || process.env.DB === 'postgresql') {
  connInfo.connectionString = 'postgres://postgres:postgres@127.0.0.1/postgres'
  isPg = true
} else if (process.env.DB === 'mariadb') {
  connInfo.connectionString = 'mysql://root@127.0.0.1:3307/graph'
  connInfo.poolSize = 10
  isMysql = true
  isMariaDB = true
} else if (process.env.DB === 'mysql') {
  connInfo.connectionString = 'mysql://root@127.0.0.1/graph'
  connInfo.poolSize = 10
  isMysql = true
} else if (process.env.DB === 'mysql8') {
  connInfo.connectionString = 'mysql://root@127.0.0.1:3308/graph'
  connInfo.poolSize = 10
  isMysql = true
  isMysql8 = true
} else if (process.env.DB === 'sqlite') {
  connInfo.connectionString = 'sqlite://:memory:'
  isSQLite = true
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

export async function clear (db, sql) {
  await dropAllTables(db, sql)
  await dropAllTables(db, sql, ['test1', 'test2'])

  try {
    await db.query(sql`DROP SCHEMA test2`)
  } catch (err) {}
  try {
    await db.query(sql`DROP SCHEMA test1`)
  } catch (err) {}
}
