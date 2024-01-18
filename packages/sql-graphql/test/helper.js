'use strict'

const why = require('why-is-node-running')
const { dropAllTables } = require('@platformatic/sql-mapper')

setInterval(() => {
  console.log('why is node running?')
  why()
}, 1000 * 30).unref() // 30 seconds

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
  module.exports.isMariaDB = true
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
  await dropAllTables(db, sql)
  await dropAllTables(db, sql, ['test1', 'test2', 'test3', 'test4'])

  try {
    await db.query(sql`DROP TYPE custom_enum`)
  } catch (err) {
  }

  try {
    await db.query(sql`DROP TYPE simple_enum`)
  } catch (err) {
  }

  try {
    await db.query(sql`DROP SCHEMA test4`)
  } catch (err) {
  }

  try {
    await db.query(sql`DROP SCHEMA test3`)
  } catch (err) {
  }

  try {
    await db.query(sql`DROP SCHEMA test2`)
  } catch (err) {
  }

  try {
    await db.query(sql`DROP SCHEMA test1`)
  } catch (err) {
  }
}
