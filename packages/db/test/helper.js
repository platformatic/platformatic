'use strict'

const why = require('why-is-node-running')
const { Agent, setGlobalDispatcher } = require('undici')

// This file must be required/imported as the first file
// in the test suite. It sets up the global environment
// to track the open handles via why-is-node-running.
setInterval(() => {
  why()
}, 20000).unref()

const agent = new Agent({
  keepAliveTimeout: 10,
  keepAliveMaxTimeout: 10,
  tls: {
    rejectUnauthorized: false
  }
})
setGlobalDispatcher(agent)

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
  await db.query(sql`DROP TABLE IF EXISTS versions;`)
  await db.query(sql`DROP TABLE IF EXISTS graphs;`)
  await db.query(sql`DROP TABLE IF EXISTS users;`)
  await db.query(sql`DROP TABLE IF EXISTS pages;`)
  await db.query(sql`DROP TABLE IF EXISTS posts;`)
  await db.query(sql`DROP TABLE IF EXISTS owners;`)
  await db.query(sql`DROP TABLE IF EXISTS categories;`)
  await db.query(sql`DROP TABLE IF EXISTS plt_db;`)
  await db.query(sql`DROP TABLE IF EXISTS generated_test;`)
}

async function createBasicPages (db, sql) {
  if (module.exports.isSQLite) {
    await db.query(sql`CREATE TABLE pages (
      id INTEGER PRIMARY KEY,
      title VARCHAR(42)
    );`)
  } else {
    await db.query(sql`CREATE TABLE pages (
      id SERIAL PRIMARY KEY,
      title VARCHAR(42)
    );`)
  }
}
module.exports.createBasicPages = createBasicPages

function buildConfig (options) {
  const base = {
    server: {},
    db: {}
  }

  return Object.assign(base, options)
}

module.exports.buildConfig = buildConfig
