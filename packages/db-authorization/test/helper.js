import why from 'why-is-node-running'

// This file must be required/imported as the first file
// in the test suite. It sets up the global environment
// to track the open handles via why-is-node-running.
if (process.env.WHY === 'true') {
  setInterval(() => {
    why()
  }, 60000).unref()
}

// Needed to work with dates & postgresql
// See https://node-postgres.com/features/types/
process.env.TZ = 'UTC'

const connInfo = {}

export let isSQLite = false
export let isMysql = false
export let isPg = false

if (!process.env.DB || process.env.DB === 'postgresql') {
  connInfo.connectionString = 'postgres://postgres:postgres@127.0.0.1/postgres'
  isPg = true
} else if (process.env.DB === 'mariadb') {
  connInfo.connectionString = 'mysql://root@127.0.0.1:3307/graph'
  connInfo.poolSize = 10
  isMysql = true
} else if (process.env.DB === 'mysql') {
  connInfo.connectionString = 'mysql://root@127.0.0.1/graph'
  connInfo.poolSize = 10
  isMysql = true
} else if (process.env.DB === 'mysql8') {
  connInfo.connectionString = 'mysql://root@127.0.0.1:3308/graph'
  connInfo.poolSize = 10
  isMysql = true
} else if (process.env.DB === 'sqlite') {
  connInfo.connectionString = 'sqlite://:memory:'
  isSQLite = true
}

const _connInfo = connInfo
export { _connInfo as connInfo }

export async function clear (db, sql) {
  try {
    await db.query(sql`DROP TABLE IF EXISTS pages CASCADE`)
  } catch (err) {}
  try {
    await db.query(sql`DROP TABLE IF EXISTS categories CASCADE`)
  } catch (err) {}
}

export async function createBasicPages (db, sql) {
  if (isSQLite) {
    await db.query(sql`CREATE TABLE IF NOT EXISTS pages (
      id INTEGER PRIMARY KEY,
      title VARCHAR(42),
      user_id INTEGER
    );`)
  } else {
    await db.query(sql`CREATE TABLE IF NOT EXISTS pages (
      id SERIAL PRIMARY KEY,
      title VARCHAR(42),
      user_id INTEGER
    );`)
  }
}
