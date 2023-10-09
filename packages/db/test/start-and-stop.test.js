'use strict'

const assert = require('node:assert/strict')
const { test } = require('node:test')
const { join } = require('node:path')
const { rm } = require('node:fs/promises')
const { request } = require('undici')
const { buildServer } = require('..')
const { buildConfigManager, getConnectionInfo, createBasicPages } = require('./helper')

test('starts, query and stop', async (t) => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo()

  const config = {
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    db: {
      ...connectionInfo,
      async onDatabaseLoad (db, sql) {
        await createBasicPages(db, sql)
      }
    }
  }

  const configManager = await buildConfigManager(config)
  const app = await buildServer({ configManager })

  t.after(async () => {
    await app.close()
    await dropTestDB()
  })
  await app.start()

  {
    const res = await request(`${app.url}/graphql`, {
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

    const data = await res.body.json()
    assert.deepEqual(data, {
      data: {
        savePage: {
          id: '1',
          title: 'Hello'
        }
      }
    }, 'savePage response')
  }

  {
    const res = await request(`${app.url}/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query {
            getPageById(id: 1) {
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
          id: '1',
          title: 'Hello'
        }
      }
    }, 'pages response')
  }

  {
    const res = await request(`${app.url}/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          mutation {
            savePage(input: { id: 1, title: "Hello World" }) {
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
          id: '1',
          title: 'Hello World'
        }
      }
    }, 'savePage response')
  }

  {
    const res = await request(`${app.url}/graphql`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query {
            getPageById(id: 1) {
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
          id: '1',
          title: 'Hello World'
        }
      }
    }, 'pages response')
  }
})

test('inject', async (t) => {
  const { connectionInfo, dropTestDB } = await getConnectionInfo()

  const config = {
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    db: {
      ...connectionInfo,
      async onDatabaseLoad (db, sql) {
        await createBasicPages(db, sql)
      }
    }
  }

  const configManager = await buildConfigManager(config)
  const app = await buildServer({ configManager })

  t.after(async () => {
    await app.close()
    await dropTestDB()
  })
  await app.start()

  {
    const res = await app.inject({
      url: '/graphql',
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
    assert.deepEqual(res.json(), {
      data: {
        savePage: {
          id: '1',
          title: 'Hello'
        }
      }
    }, 'savePage response')
  }
})

test('ignore and sqlite3', async (t) => {
  const dbLocation = join(__dirname, '..', 'fixtures', 'sqlite', 'db-ignore-and-sqlite3')
  const migrations = join(__dirname, '..', 'fixtures', 'sqlite', 'migrations')

  try {
    await rm(dbLocation)
  } catch {
    // ignore
  }

  const config = {
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    db: {
      connectionString: `sqlite://${dbLocation}`
    },
    migrations: {
      dir: migrations
    }
  }

  const configManager = await buildConfigManager(config)
  const app = await buildServer({ configManager })

  t.after(async () => {
    await app.close()
    await rm(dbLocation)
  })
  await app.start()

  {
    const res = await (request(`${app.url}/`))
    assert.equal(res.statusCode, 200, 'root status code')
    res.body.resume()
  }
})

test('starts a config file on disk with auto-apply', async (t) => {
  const app = await buildServer(join(__dirname, 'fixtures', 'sqlite', 'no-logger.json'))

  t.after(async () => {
    await app.close()
    await rm(join(__dirname, 'fixtures', 'sqlite', 'db-no-logger'))
  })
  await app.start()

  {
    const res = await (request(`${app.url}/`))
    assert.equal(res.statusCode, 200, 'root status code')
    res.body.resume()
  }
})
