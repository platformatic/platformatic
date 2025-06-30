'use strict'

const { tmpdir } = require('node:os')
const { join } = require('node:path')
const { randomUUID } = require('node:crypto')
const why = require('why-is-node-running')
const { ConfigManager } = require('@platformatic/config')
const { createConnectionPool } = require('@platformatic/sql-mapper')
const { safeRemove } = require('@platformatic/utils')
const { Agent, setGlobalDispatcher } = require('undici')
const { createTemporaryDirectory } = require('../../basic/test/helper')
const { create, platformaticDatabase } = require('..')

// This file must be required/imported as the first file
// in the test suite. It sets up the global environment
// to track the open handles via why-is-node-running.
setInterval(() => {
  why()
}, 60000).unref()

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
        return safeRemove(pathToSqlite)
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
    baseConnectionString = 'mysql://root@127.0.0.1:3308/'
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
  connectionInfo.dbname = testDBName
  connectionInfo.connectionString = baseConnectionString + testDBName

  return {
    connectionInfo,
    async dropTestDB () {
      await db.query(sql`DROP DATABASE ${sql.ident(testDBName)};`)
      await db.dispose()
    }
  }
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
    ...platformaticDatabase.configManagerConfig,
    source,
    dirname
  })

  await configManager.parseAndValidate()
  return configManager
}

async function createFromConfig (t, options, applicationFactory, creationOptions = {}) {
  const directory = await createTemporaryDirectory(t)

  const database = await create(
    directory,
    options,
    {},
    { applicationFactory, isStandalone: true, isEntrypoint: true, isProduction: creationOptions.production }
  )
  t.after(() => database.stop())

  if (!creationOptions.skipInit) {
    await database.init()
  }

  return database
}

module.exports = {
  getConnectionInfo,
  createBasicPages,
  buildConfigManager,
  createFromConfig
}

if (!process.env.DB || process.env.DB === 'postgresql') {
  module.exports.isPg = true
  module.exports.expectedTelemetryPrefix = 'pg'
  module.exports.expectedPort = 5432
} else if (process.env.DB === 'mariadb') {
  module.exports.isMysql = true
  module.exports.expectedTelemetryPrefix = 'mysql'
  module.exports.expectedPort = '3307'
} else if (process.env.DB === 'mysql') {
  module.exports.isMysql = true
  module.exports.expectedTelemetryPrefix = 'mysql'
  module.exports.expectedPort = 3306
} else if (process.env.DB === 'mysql8') {
  module.exports.isMysql = true
  module.exports.isMysql8 = true
  module.exports.expectedTelemetryPrefix = 'mysql'
  module.exports.expectedPort = '3308'
} else if (process.env.DB === 'sqlite') {
  module.exports.isSQLite = true
  module.exports.expectedTelemetryPrefix = 'sqlite'
}
