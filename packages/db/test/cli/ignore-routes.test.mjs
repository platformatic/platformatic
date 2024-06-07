import assert from 'node:assert/strict'
import { test } from 'node:test'
import { join } from 'desm'
import { request } from 'undici'
import { getConnectionInfo } from '../helper.js'
import { connectDB, start } from './helper.js'

test('ignores openapi routes', async (t) => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo('postgresql')
  const db = await connectDB(connectionInfo)

  await db.query(db.sql`CREATE TABLE pages (
    id SERIAL PRIMARY KEY,
    title VARCHAR(42)
  );`)

  await db.query(
    db.sql`INSERT INTO pages (id, title) VALUES (1, 'Hello');`
  )

  t.after(async () => {
    await db.dispose()
    await dropTestDB()
  })

  const { child, url } = await start(
    ['-c', join(import.meta.url, '..', 'fixtures', 'ignore-routes.json')],
    {
      env: {
        DATABASE_URL: connectionInfo.connectionString
      }
    }
  )

  {
    const { statusCode, body } = await request(`${url}/pages`)
    const data = await body.json()
    assert.equal(statusCode, 200)
    assert.deepEqual(data, [{ id: 1, title: 'Hello' }])
  }

  {
    const { statusCode } = await request(`${url}/pages/1`)
    assert.equal(statusCode, 404)
  }

  {
    const { statusCode } = await request(`${url}/pages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ title: 'World' })
    })
    assert.equal(statusCode, 404)
  }

  child.kill('SIGINT')
})
