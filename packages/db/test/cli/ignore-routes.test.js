'use strict'

const { join } = require('node:path')
const { deepEqual } = require('node:assert')
const { test } = require('node:test')
const { request } = require('undici')
const { getConnectionInfo } = require('../helper.js')
const { connectDB, safeKill, start } = require('./helper.js')

test('ignores openapi routes', async t => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo('sqlite')
  const db = await connectDB(connectionInfo)

  await db.query(db.sql`CREATE TABLE pages (
    id SERIAL PRIMARY KEY,
    title VARCHAR(42)
  );`)

  await db.query(db.sql`INSERT INTO pages (id, title) VALUES (1, 'Hello');`)

  t.after(async () => {
    await db.dispose()
    await dropTestDB()
  })

  const { child, url } = await start([join(__dirname, '..', 'fixtures', 'ignore-routes.json')], {
    env: {
      DATABASE_URL: connectionInfo.connectionString
    }
  })

  t.after(() => safeKill(child))

  {
    const { statusCode, body } = await request(`${url}/pages`)
    const data = await body.json()
    deepEqual(statusCode, 200)
    deepEqual(data, [{ id: 1, title: 'Hello' }])
  }

  {
    const { statusCode } = await request(`${url}/pages/1`)
    deepEqual(statusCode, 404)
  }

  {
    const { statusCode } = await request(`${url}/pages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ title: 'World' })
    })
    deepEqual(statusCode, 404)
  }
})
