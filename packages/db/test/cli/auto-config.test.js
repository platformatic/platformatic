'use strict'

const assert = require('node:assert/strict')
const { test } = require('node:test')
const { join } = require('node:path')
const { request } = require('undici')
const { getConnectionInfo } = require('../helper')
const { start, connectDB } = require('./helper.js')

const fileTypes = ['yaml', 'yml', 'toml', 'tml', 'json', 'json5']
for (const fileType of fileTypes) {
  test(`auto config - ${fileType}`, async (t) => {
    const { connectionInfo, dropTestDB } = await getConnectionInfo()
    const db = await connectDB(connectionInfo)

    t.after(() => db.dispose())
    t.after(() => dropTestDB())

    await db.query(db.sql`CREATE TABLE pages (
      id SERIAL PRIMARY KEY,
      title VARCHAR(42)
    );`)

    const { child, url } = await start([
      '-c', join(__dirname, '..', 'fixtures', 'auto-config', fileType, 'platformatic.db.' + fileType)
    ], {
      env: {
        DATABASE_URL: connectionInfo.connectionString
      }
    })

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
}
