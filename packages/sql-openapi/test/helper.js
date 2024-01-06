'use strict'

const why = require('why-is-node-running')

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
  module.exports.isMysql8 = true
} else if (process.env.DB === 'sqlite') {
  connInfo.connectionString = 'sqlite://:memory:'
  module.exports.isSQLite = true
}

module.exports.connInfo = connInfo

module.exports.createBasicPages = async function createBasicPages (db, sql) {
  if (module.exports.isSQLite) {
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

module.exports.clear = async function (db, sql) {
  try {
    await db.query(sql`DROP TABLE editors`)
  } catch (err) {
  }

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

  try {
    await db.query(sql`DROP TABLE people`)
  } catch (err) {
  }

  try {
    await db.query(sql`DROP TABLE generated_test`)
  } catch (err) {
  }

  // Don't change the order of these drops below
  try {
    await db.query(sql`DROP TABLE test1.editors`)
  } catch (err) {
  }
  try {
    await db.query(sql`DROP TABLE test2.users`)
  } catch (err) {
  }
  try {
    await db.query(sql`DROP TABLE test1.pages`)
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
