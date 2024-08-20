'use strict'

const assert = require('node:assert')
const { join } = require('node:path')
const { test } = require('node:test')
const { Client } = require('undici')

const { buildServer } = require('../..')
const fixturesDir = join(__dirname, '..', '..', 'fixtures')

test('should get service db info', async (t) => {
  const projectDir = join(fixturesDir, 'management-api')
  const configFile = join(projectDir, 'platformatic.json')
  const app = await buildServer(configFile)

  await app.start()

  const client = new Client({
    hostname: 'localhost',
    protocol: 'http:',
  }, {
    socketPath: app.getManagementApiUrl(),
    keepAliveTimeout: 10,
    keepAliveMaxTimeout: 10,
  })

  t.after(async () => {
    await Promise.all([
      client.close(),
      app.close(),
    ])
  })

  const { statusCode, body } = await client.request({
    method: 'GET',
    path: '/api/v1/services/service-db/db-info',
  })

  assert.strictEqual(statusCode, 200)

  const dbInfo = await body.json()

  const database = join(fixturesDir, 'management-api', 'services', 'service-db', 'db.sqlite')

  assert.deepStrictEqual(dbInfo.connectionInfo, {
    database,
    isSQLite: true,
    dbSystem: 'sqlite',
  })

  const tables = dbInfo.dbschema.map(table => table.table)
  assert.deepStrictEqual(tables, ['versions', 'movies'])

  {
    // Must return null if not a db service
    const { statusCode, body } = await client.request({
      method: 'GET',
      path: '/api/v1/services/service-1/db-info',
    })
    assert.strictEqual(statusCode, 200)
    const dbInfo = await body.json()
    assert.strictEqual(dbInfo, null)
  }
})
