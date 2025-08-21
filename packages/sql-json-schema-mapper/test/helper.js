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
} else if (process.env.DB === 'sqlite') {
  connInfo.connectionString = 'sqlite://:memory:'
  isSQLite = true
}

export async function clear (db, sql) {
  try {
    await db.query(sql`DROP TABLE pages`)
  } catch (err) {}

  try {
    await db.query(sql`DROP TABLE categories`)
  } catch {}

  try {
    await db.query(sql`DROP TABLE posts`)
  } catch {}

  try {
    await db.query(sql`DROP TABLE simple_types`)
  } catch {}

  try {
    await db.query(sql`DROP TABLE owners`)
  } catch {}

  try {
    await db.query(sql`DROP TABLE users`)
  } catch {}

  try {
    await db.query(sql`DROP TABLE versions`)
  } catch {}

  try {
    await db.query(sql`DROP TABLE graphs`)
  } catch {}

  try {
    await db.query(sql`DROP Type pagetype`)
  } catch {}

  try {
    await db.query(sql`DROP TABLE generated_test`)
  } catch {}
}
