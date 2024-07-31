'use strict'

const { connect, dropAllTables } = require('..')

// Needed to work with dates & postgresql
// See https://node-postgres.com/features/types/
process.env.TZ = 'UTC'

const connInfo = {
  autoTimestamp: {
    createdAt: 'inserted_at',
    updatedAt: 'updated_at',
  },
}

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
  module.exports.isMysql8 = true
} else if (process.env.DB === 'sqlite') {
  connInfo.connectionString = 'sqlite://:memory:'
  module.exports.isSQLite = true
}

module.exports.connInfo = connInfo

module.exports.clear = async function (db, sql) {
  await dropAllTables(db, sql)
  await dropAllTables(db, sql, ['test1', 'test2'])
}

const fakeLogger = {
  trace: () => { },
  debug: () => { },
  info: () => { },
  warn: () => { },
  error: () => { },
  fatal: () => { },
}

module.exports.fakeLogger = fakeLogger

module.exports.setupDatabase = async function ({ seed, cache, t }) {
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
    cache,
  })
}

module.exports.createBasicPages = async function (db, sql) {
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
