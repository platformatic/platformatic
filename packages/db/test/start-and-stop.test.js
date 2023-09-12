'use strict'

const { connInfo, clear, createBasicPages, createAndPopulateUsersTable, dropUsersTable, buildConfig } = require('./helper')
const { test } = require('tap')
const { buildServer } = require('..')
const { request } = require('undici')
const { rm } = require('fs/promises')
const path = require('path')

test('starts, query and stop', async ({ teardown, equal, pass, same }) => {
  const app = await buildServer(buildConfig({
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    db: {
      ...connInfo,
      async onDatabaseLoad (db, sql) {
        pass('onDatabaseLoad called')

        await clear(db, sql)
        await createBasicPages(db, sql)
      }
    }
  }))

  teardown(async () => {
    await app.close()
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
    equal(res.statusCode, 200, 'savePage status code')
    same(await res.body.json(), {
      data: {
        savePage: {
          id: 1,
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
    equal(res.statusCode, 200, 'pages status code')
    same(await res.body.json(), {
      data: {
        getPageById: {
          id: 1,
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
    equal(res.statusCode, 200, 'savePage status code')
    same(await res.body.json(), {
      data: {
        savePage: {
          id: 1,
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
    equal(res.statusCode, 200, 'pages status code')
    same(await res.body.json(), {
      data: {
        getPageById: {
          id: 1,
          title: 'Hello World'
        }
      }
    }, 'pages response')
  }
})

test('inject', async ({ teardown, equal, pass, same }) => {
  const app = await buildServer(buildConfig({
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    db: {
      ...connInfo,
      async onDatabaseLoad (db, sql) {
        pass('onDatabaseLoad called')

        await clear(db, sql)
        await createBasicPages(db, sql)
      }
    }
  }))

  teardown(async () => {
    await app.close()
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
    equal(res.statusCode, 200, 'savePage status code')
    same(res.json(), {
      data: {
        savePage: {
          id: 1,
          title: 'Hello'
        }
      }
    }, 'savePage response')
  }
})

test('ignore and sqlite3', async ({ teardown, equal, pass, same }) => {
  const dbLocation = path.join(__dirname, '..', 'fixtures', 'sqlite', 'db')
  const migrations = path.join(__dirname, '..', 'fixtures', 'sqlite', 'migrations')
  try {
    await rm(dbLocation)
  } catch {
    // ignore
  }
  const app = await buildServer(buildConfig({
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
  }))

  teardown(async () => {
    await app.close()
  })
  await app.start()

  {
    const res = await (request(`${app.url}/`))
    equal(res.statusCode, 200, 'root status code')
    res.body.resume()
  }
})

test('starts a config file on disk with auto-apply', async ({ teardown, equal, pass, same }) => {
  const app = await buildServer(path.join(__dirname, 'fixtures', 'sqlite', 'no-logger.json'))

  teardown(async () => {
    await app.close()
  })
  await app.start()

  {
    const res = await (request(`${app.url}/`))
    equal(res.statusCode, 200, 'root status code')
    res.body.resume()
  }
})
