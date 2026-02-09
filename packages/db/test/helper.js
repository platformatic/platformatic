import { safeRemove } from '@platformatic/foundation'
import { createConnectionPool } from '@platformatic/sql-mapper'
import { randomUUID } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Agent, setGlobalDispatcher } from 'undici'
import why from 'why-is-node-running'
import { createTemporaryDirectory } from '../../basic/test/helper.js'
import { create } from '../index.js'

const expectedTelemetryPrefixes = {
  postgresql: 'pg',
  mariadb: 'mysql',
  mysql: 'mysql',
  mysql8: 'mysql',
  sqlite: 'sqlite'
}

const expectedPorts = {
  postgresql: 5432,
  mariadb: 3307,
  mysql: 3306,
  mysql8: 3308,
  sqlite: undefined
}

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

export async function getConnectionInfo (dbType) {
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

export async function createBasicPages (db, sql) {
  if (isSQLite) {
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

export async function createFromConfig (t, options, applicationFactory, creationOptions = {}) {
  const directory = await createTemporaryDirectory(t)

  const database = await create(directory, options, {
    applicationFactory,
    isStandalone: true,
    isEntrypoint: true,
    isProduction: creationOptions.production
  })
  t.after(() => database.stop())

  if (!creationOptions.skipInit) {
    await database.init()
  }

  return database
}

export const isPg = !process.env.DB || process.env.DB === 'postgresql'
export const isMariaDB = process.env.DB === 'mariadb'
export const isMysql = process.env.DB === 'mariadb' || process.env.DB === 'mysql' || process.env.DB === 'mysql8'
export const isMysql8 = process.env.DB === 'mysql8'
export const isSQLite = process.env.DB === 'sqlite'
export const expectedTelemetryPrefix = expectedTelemetryPrefixes[process.env.DB] || expectedTelemetryPrefixes.postgresql
export const expectedPort = expectedPorts[process.env.DB] || expectedPorts.postgresql
