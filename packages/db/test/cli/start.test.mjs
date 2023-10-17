import assert from 'node:assert/strict'
import { test } from 'node:test'
import { join } from 'desm'
import { request } from 'undici'
import { getConnectionInfo } from '../helper.js'
import { connectDB, start } from './helper.js'

test('autostart', async (t) => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo('postgresql')
  const db = await connectDB(connectionInfo)

  await db.query(db.sql`CREATE TABLE pages (
    id SERIAL PRIMARY KEY,
    title VARCHAR(42)
  );`)

  t.after(async () => {
    await db.dispose()
    await dropTestDB()
  })

  const { child, url } = await start(
    ['-c', join(import.meta.url, '..', 'fixtures', 'simple.json')],
    {
      env: {
        DATABASE_URL: connectionInfo.connectionString
      }
    }
  )

  let id
  {
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
    id = body.data.savePage.id
  }

  {
    const res = await request(`${url}/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
              query {
                getPageById(id: ${id}) {
                  id
                  title
                }
              }
            `
      })
    })
    assert.equal(res.statusCode, 200, 'pages status code')
    assert.deepEqual(await res.body.json(), {
      data: {
        getPageById: {
          id,
          title: 'Hello'
        }
      }
    }, 'pages response')
  }

  {
    const res = await request(`${url}/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
              mutation {
                savePage(input: { id: ${id}, title: "Hello World" }) {
                  id
                  title
                }
              }
            `
      })
    })
    assert.equal(res.statusCode, 200, 'savePage status code')
    assert.deepEqual(await res.body.json(), {
      data: {
        savePage: {
          id,
          title: 'Hello World'
        }
      }
    }, 'savePage response')
  }

  {
    const res = await request(`${url}/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
              query {
                getPageById(id: ${id}) {
                  id
                  title
                }
              }
            `
      })
    })
    assert.equal(res.statusCode, 200, 'pages status code')
    assert.deepEqual(await res.body.json(), {
      data: {
        getPageById: {
          id,
          title: 'Hello World'
        }
      }
    }, 'pages response')
  }

  child.kill('SIGINT')
})

test('start command', async (t) => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo('postgresql')
  const db = await connectDB(connectionInfo)

  await db.query(db.sql`CREATE TABLE pages (
    id SERIAL PRIMARY KEY,
    title VARCHAR(42)
  );`)

  t.after(async () => {
    await db.dispose()
    await dropTestDB()
  })

  const { child, url } = await start(
    ['-c', join(import.meta.url, '..', 'fixtures', 'simple.json')],
    {
      env: {
        DATABASE_URL: connectionInfo.connectionString
      }
    }
  )

  let id
  {
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
    assert.deepEqual(body.data.savePage.title, 'Hello', 'savePage response')
    id = body.data.savePage.id
  }

  {
    const res = await request(`${url}/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
              query {
                getPageById(id: ${id}) {
                  id
                  title
                }
              }
            `
      })
    })
    assert.equal(res.statusCode, 200, 'pages status code')
    assert.deepEqual(await res.body.json(), {
      data: {
        getPageById: {
          id,
          title: 'Hello'
        }
      }
    }, 'pages response')
  }

  {
    const res = await request(`${url}/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
              mutation {
                savePage(input: { id: ${id}, title: "Hello World" }) {
                  id
                  title
                }
              }
            `
      })
    })
    assert.equal(res.statusCode, 200, 'savePage status code')
    assert.deepEqual(await res.body.json(), {
      data: {
        savePage: {
          id,
          title: 'Hello World'
        }
      }
    }, 'savePage response')
  }

  {
    const res = await request(`${url}/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
              query {
                getPageById(id: ${id}) {
                  id
                  title
                }
              }
            `
      })
    })
    assert.equal(res.statusCode, 200, 'pages status code')
    assert.deepEqual(await res.body.json(), {
      data: {
        getPageById: {
          id,
          title: 'Hello World'
        }
      }
    }, 'pages response')
  }

  child.kill('SIGINT')
})
