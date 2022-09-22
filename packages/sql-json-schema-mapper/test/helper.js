'use strict'

// Needed to work with dates & postgresql
// See https://node-postgres.com/features/types/
process.env.TZ = 'UTC'

const connInfo = {}

if (!process.env.DB || process.env.DB === 'postgresql') {
  connInfo.connectionString = 'postgres://postgres:postgres@127.0.0.1/postgres'
  module.exports.isPg = true
} else if (process.env.DB === 'mariadb') {
  connInfo.connectionString = 'mysql://root@127.0.0.1:3307/graph'
  connInfo.poolSize = 10
  module.exports.isMysql = true
} else if (process.env.DB === 'mysql') {
  connInfo.connectionString = 'mysql://root@127.0.0.1/graph'
  connInfo.poolSize = 10
  module.exports.isMysql = true
} else if (process.env.DB === 'mysql8') {
  connInfo.connectionString = 'mysql://root@127.0.0.1:3308/graph'
  connInfo.poolSize = 10
  module.exports.isMysql = true
} else if (process.env.DB === 'sqlite') {
  connInfo.connectionString = 'sqlite://:memory:'
  module.exports.isSQLite = true
}

module.exports.connInfo = connInfo

module.exports.clear = async function (db, sql) {
  try {
    await db.query(sql`DROP TABLE pages`)
  } catch (err) {
  }

  try {
    await db.query(sql`DROP TABLE categories`)
  } catch {
  }

  try {
    await db.query(sql`DROP TABLE posts`)
  } catch {
  }

  try {
    await db.query(sql`DROP TABLE simple_types`)
  } catch {
  }

  try {
    await db.query(sql`DROP TABLE owners`)
  } catch {
  }

  try {
    await db.query(sql`DROP TABLE users`)
  } catch {
  }

  try {
    await db.query(sql`DROP TABLE versions`)
  } catch {
  }

  try {
    await db.query(sql`DROP TABLE graphs`)
  } catch {
  }
}
