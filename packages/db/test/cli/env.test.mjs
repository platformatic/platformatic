import assert from 'node:assert'
import { test } from 'node:test'
import { join } from 'desm'
import { request } from 'undici'
import { execa } from 'execa'
import { getConnectionInfo } from '../helper.js'
import { start, cliPath, connectDB } from './helper.js'

test('env white list', async (t) => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo()
  const db = await connectDB(connectionInfo)

  t.after(() => db.dispose())
  t.after(() => dropTestDB())

  await db.query(db.sql`CREATE TABLE pages (
    id SERIAL PRIMARY KEY,
    title VARCHAR(42)
  );`)

  const { child, url } = await start(
    [
      '--config', join(import.meta.url, '..', 'fixtures', 'env-whitelist.json'),
      '--allow-env', 'DATABASE_URL,HOSTNAME'
    ],
    {
      env: {
        DATABASE_URL: connectionInfo.connectionString,
        HOSTNAME: '127.0.0.1'
      }
    }
  )

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

  child.kill('SIGINT')
})

test('env white list default values', async (t) => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo()
  const db = await connectDB(connectionInfo)

  t.after(() => db.dispose())
  t.after(() => dropTestDB())

  await db.query(db.sql`CREATE TABLE pages (
    id SERIAL PRIMARY KEY,
    title VARCHAR(42)
  );`)

  const { child, url } = await start(
    [
      '--config', join(import.meta.url, '..', 'fixtures', 'env-whitelist-default.json')
    ],
    {
      env: {
        DATABASE_URL: connectionInfo.connectionString,
        PORT: 10555
      }
    }
  )

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

  child.kill('SIGINT')
})

test('env white list schema', async (t) => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo()
  const db = await connectDB(connectionInfo)

  t.after(() => db.dispose())
  t.after(() => dropTestDB())

  await db.query(db.sql`CREATE TABLE pages (
    id SERIAL PRIMARY KEY,
    title VARCHAR(42)
  );`)

  const { stdout } = await execa('node', [
    cliPath,
    'schema',
    'graphql',
    '--config',
    join(import.meta.url, '..', 'fixtures', 'env-whitelist.json'),
    '--allow-env',
    'DATABASE_URL,HOSTNAME'
  ], {
    env: {
      DATABASE_URL: connectionInfo.connectionString,
      HOSTNAME: '127.0.0.1'
    }
  })

  const snapshot = await import('../../snapshots/test/cli/env.test.mjs')
  assert.equal(stdout, snapshot.default)
})
