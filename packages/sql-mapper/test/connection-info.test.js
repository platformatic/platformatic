import { equal } from 'node:assert'
import { test } from 'node:test'
import { getConnectionInfo } from '../lib/connection-info.js'

test('get connection info for postgres', async t => {
  const db = {
    isPg: true,
    _pool: {
      getConnection: async () => ({
        connection: {
          client: {
            connectionParameters: {
              host: 'localhost',
              port: 5432,
              database: 'database',
              user: 'user'
            }
          }
        },
        release: () => {}
      })
    }
  }
  const connectionInfo = await getConnectionInfo(db)
  equal(connectionInfo.dbSystem, 'postgresql')
  equal(connectionInfo.database, 'database')
  equal(connectionInfo.host, 'localhost')
  equal(connectionInfo.port, 5432)
  equal(connectionInfo.user, 'user')
  equal(connectionInfo.isPg, true)
  equal(connectionInfo.isMySql, false)
  equal(connectionInfo.isSQLite, false)
})

test('get connection info for mysql', async t => {
  const db = {
    isMySql: true,
    _pool: {
      getConnection: async () => ({
        connection: {
          client: {
            config: {
              host: 'localhost',
              port: 3306,
              database: 'database',
              user: 'user'
            }
          }
        },
        release: () => {}
      })
    }
  }
  const connectionInfo = await getConnectionInfo(db)
  equal(connectionInfo.dbSystem, 'mysql')
  equal(connectionInfo.database, 'database')
  equal(connectionInfo.host, 'localhost')
  equal(connectionInfo.port, 3306)
  equal(connectionInfo.user, 'user')
  equal(connectionInfo.isPg, false)
  equal(connectionInfo.isMySql, true)
  equal(connectionInfo.isSQLite, false)
})

test('get connection info for sqlite', async t => {
  const db = {
    isSQLite: true
  }
  const connectionInfo = await getConnectionInfo(db, 'sqlite://database')
  equal(connectionInfo.dbSystem, 'sqlite')
  equal(connectionInfo.database, 'database')
  equal(connectionInfo.host, undefined)
  equal(connectionInfo.port, undefined)
  equal(connectionInfo.user, undefined)
  equal(connectionInfo.isPg, false)
  equal(connectionInfo.isMySql, false)
  equal(connectionInfo.isSQLite, true)
})

test('get connection info for unknown', async t => {
  const db = {}
  const connectionInfo = await getConnectionInfo(db)
  equal(connectionInfo.dbSystem, 'unknown')
  equal(connectionInfo.isPg, false)
  equal(connectionInfo.isMySql, false)
  equal(connectionInfo.isSQLite, false)
})
