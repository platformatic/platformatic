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

export const connInfo = {}
export let isPg = false
export let isMysql = false
export let isSQLite = false

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

export async function clear (db, sql) {
  try {
    await db.query(sql`DROP TABLE pages`)
  } catch (err) {}
}

export function buildConfig (options) {
  const base = {
    server: {},
    core: {},
    cli: {},
    authorization: {}
  }

  return Object.assign(base, options)
}
