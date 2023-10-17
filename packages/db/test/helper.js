'use strict'

const { tmpdir } = require('node:os')
const { join } = require('node:path')
const { rm } = require('node:fs/promises')
const { randomUUID } = require('node:crypto')
const why = require('why-is-node-running')
const { createConnectionPool } = require('@platformatic/sql-mapper')
const { Agent, setGlobalDispatcher } = require('undici')
const { platformaticDB, ConfigManager } = require('..')

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

async function getConnectionInfo (dbType) {
  dbType = dbType || process.env.DB || 'postgresql'

  if (dbType === 'sqlite') {
    const pathToSqlite = join(tmpdir(), randomUUID())
    const connectionString = `sqlite://${pathToSqlite}`

    return {
      connectionInfo: {
        connectionString
      },
      async dropTestDB () {
        await rm(pathToSqlite).catch(() => {})
      }
    }
  }

  let baseConnectionString = null
  if (dbType === 'postgresql') {
    baseConnectionString = 'postgres://postgres:postgres@127.0.0.1/'
  } else if (dbType === 'mariadb') {
    baseConnectionString = 'mysql://root@127.0.0.1:3307/'
  } else if (dbType === 'mysql') {
    baseConnectionString = 'mysql://root@127.0.0.1/'
  } else if (dbType === 'mysql8') {
    baseConnectionString = 'mysql://root@localhost:3308/'
  }

  const { db, sql } = await createConnectionPool({
    log: {
      debug: () => {},
      info: () => {},
      trace: () => {},
      error: () => {}
    },
    connectionString: baseConnectionString,
    poolSize: 1
  })

  const connectionInfo = {}
  const testDBName = 'test_db_' + randomUUID().replace(/-/g, '')

  await db.query(sql`CREATE DATABASE ${sql.ident(testDBName)};`)
  connectionInfo.connectionString = baseConnectionString + testDBName

  return {
    connectionInfo,
    async dropTestDB () {
      await db.query(sql`DROP DATABASE ${sql.ident(testDBName)};`)
      await db.dispose()
    }
  }
}

module.exports.getConnectionInfo = getConnectionInfo

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

async function buildConfigManager (source, dirname) {
  const base = {
    server: {},
    db: {}
  }
  source = Object.assign(base, source)

  if (!dirname) {
    dirname = join(__dirname, 'fixtures')
  }

  const configManager = new ConfigManager({
    ...platformaticDB.configManagerConfig,
    source,
    dirname
  })

  await configManager.parseAndValidate()
  return configManager
}

module.exports.buildConfigManager = buildConfigManager
