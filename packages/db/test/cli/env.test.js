import assert from 'node:assert'
import { resolve } from 'node:path'
import { test } from 'node:test'
import { request } from 'undici'
import { printSchema } from '../../lib/commands/print-schema.js'
import { snapshot } from '../fixtures/snapshots/env.js'
import { getConnectionInfo } from '../helper.js'
import { connectDB, safeKill, start } from './helper.js'
import { createCapturingLogger, createTestContext, withTestEnvironment } from './test-utilities.js'

test('env white list', async t => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo()
  const db = await connectDB(connectionInfo)

  t.after(() => db.dispose())
  t.after(() => dropTestDB())

  await db.query(db.sql`CREATE TABLE pages (
    id SERIAL PRIMARY KEY,
    title VARCHAR(42)
  );`)

  const { child, url } = await start([resolve(import.meta.dirname, '..', 'fixtures', 'env-whitelist.json')], {
    env: {
      DATABASE_URL: connectionInfo.connectionString,
      HOSTNAME: '127.0.0.1'
    }
  })

  {
    // should connect to db and query it.
    const res = await request(`${url}/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
              mutation {
                savePage(input: { title: "Hello" }) {
                  id
                  title
                }
              }
            `
      })
    })
    assert.equal(res.statusCode, 200, 'savePage status code')
    const body = await res.body.json()
    assert.equal(body.data.savePage.title, 'Hello')
  }

  await safeKill(child)
})

test('env white list default values', async t => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo()
  const db = await connectDB(connectionInfo)

  t.after(() => db.dispose())
  t.after(() => dropTestDB())

  await db.query(db.sql`CREATE TABLE pages (
    id SERIAL PRIMARY KEY,
    title VARCHAR(42)
  );`)

  const { child, url } = await start([resolve(import.meta.dirname, '..', 'fixtures', 'env-whitelist-default.json')], {
    env: {
      DATABASE_URL: connectionInfo.connectionString,
      PORT: 10555
    }
  })

  assert.equal(url, 'http://127.0.0.1:10555')
  {
    // should connect to db and query it.
    const res = await request(`${url}/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
              mutation {
                savePage(input: { title: "Hello" }) {
                  id
                  title
                }
              }
            `
      })
    })
    assert.equal(res.statusCode, 200, 'savePage status code')
    const body = await res.body.json()
    assert.equal(body.data.savePage.title, 'Hello')
  }

  await safeKill(child)
})

test('env white list schema', async t => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo()
  const db = await connectDB(connectionInfo)

  t.after(() => db.dispose())
  t.after(() => dropTestDB())

  await db.query(db.sql`CREATE TABLE pages (
    id SERIAL PRIMARY KEY,
    title VARCHAR(42)
  );`)

  await withTestEnvironment({
    envVars: {
      DATABASE_URL: connectionInfo.connectionString,
      HOSTNAME: '127.0.0.1'
    },
    captureConsole: true
  }, async (captureObj) => {
    const logger = createCapturingLogger()
    const context = createTestContext()

    await printSchema(logger, resolve(import.meta.dirname, '..', 'fixtures', 'env-whitelist.json'), ['graphql'], context)

    assert.equal(captureObj.get().trim(), snapshot)
  })()
})
