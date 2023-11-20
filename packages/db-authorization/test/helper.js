'use strict'

const why = require('why-is-node-running')

// This file must be required/imported as the first file
// in the test suite. It sets up the global environment
// to track the open handles via why-is-node-running.
setInterval(() => {
  why()
}, 20000).unref()

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
    await db.query(sql`DROP TABLE IF EXISTS pages CASCADE`)
  } catch (err) {
  }
  try {
    await db.query(sql`DROP TABLE IF EXISTS categories CASCADE`)
  } catch (err) {
  }
}

async function createBasicPages (db, sql) {
  if (module.exports.isSQLite) {
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

module.exports.createBasicPages = createBasicPages
