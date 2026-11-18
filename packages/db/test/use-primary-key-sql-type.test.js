import assert from 'node:assert/strict'
import { test } from 'node:test'
import { request } from 'undici'
import { createFromConfig, getConnectionInfo } from './helper.js'

async function createApp (t, connectionInfo, dbOptions) {
  const app = await createFromConfig(t, {
    server: { hostname: '127.0.0.1', port: 0, logger: { level: 'fatal' } },
    db: {
      ...connectionInfo,
      ...dbOptions,
      async onDatabaseLoad (db, sql) {
        await db.query(sql`CREATE TABLE categories (
          id INTEGER PRIMARY KEY,
          name VARCHAR(42)
        );`)
        await db.query(sql`CREATE TABLE pages (
          id INTEGER PRIMARY KEY,
          title VARCHAR(42),
          category_id INTEGER REFERENCES categories(id)
        );`)
      }
    }
  })

  await app.start({ listen: true })
  return app
}

test('usePrimaryKeySqlType is honoured through the db configuration', async t => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo('sqlite')

  const app = await createApp(t, connectionInfo, { usePrimaryKeySqlType: true })
  t.after(async () => {
    await app.stop()
    await dropTestDB()
  })

  const created = await request(`${app.url}/categories`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: 1, name: 'fiction' })
  })
  assert.equal(created.statusCode, 200)
  assert.deepEqual(await created.body.json(), { id: 1, name: 'fiction' })

  const page = await request(`${app.url}/pages`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: 1, title: 'a page', categoryId: 1 })
  })
  assert.equal(page.statusCode, 200)
  assert.deepEqual(await page.body.json(), { id: 1, title: 'a page', categoryId: 1 })
})

test('primary keys stay strings without the option', async t => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo('sqlite')

  const app = await createApp(t, connectionInfo, {})
  t.after(async () => {
    await app.stop()
    await dropTestDB()
  })

  const created = await request(`${app.url}/categories`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: 1, name: 'fiction' })
  })
  assert.equal(created.statusCode, 200)
  assert.deepEqual(await created.body.json(), { id: '1', name: 'fiction' })
})
