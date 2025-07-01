'use strict'

const { execa } = require('execa')
const assert = require('node:assert')
const { resolve } = require('node:path')
const { test } = require('node:test')
const { request } = require('undici')
const { getConnectionInfo } = require('../helper.js')
const { cliPath, connectDB, safeKill, start } = require('./helper.js')

test('env white list', async t => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo()
  const db = await connectDB(connectionInfo)

  t.after(() => db.dispose())
  t.after(() => dropTestDB())

  await db.query(db.sql`CREATE TABLE pages (
    id SERIAL PRIMARY KEY,
    title VARCHAR(42)
  );`)

  const { child, url } = await start([resolve(__dirname, '..', 'fixtures', 'env-whitelist.json')], {
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

  const { child, url } = await start([resolve(__dirname, '..', 'fixtures', 'env-whitelist-default.json')], {
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
  const snapshot = require('../fixtures/snapshots/env.test.js')
  const { connectionInfo, dropTestDB } = await getConnectionInfo()
  const db = await connectDB(connectionInfo)

  t.after(() => db.dispose())
  t.after(() => dropTestDB())

  await db.query(db.sql`CREATE TABLE pages (
    id SERIAL PRIMARY KEY,
    title VARCHAR(42)
  );`)

  const { stdout } = await execa(
    'node',
    [cliPath, 'printSchema', resolve(__dirname, '..', 'fixtures', 'env-whitelist.json'), 'graphql'],
    {
      env: {
        DATABASE_URL: connectionInfo.connectionString,
        HOSTNAME: '127.0.0.1'
      }
    }
  )

  assert.equal(stdout, snapshot)
})
