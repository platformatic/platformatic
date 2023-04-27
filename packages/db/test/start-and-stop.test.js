'use strict'

const { connInfo, clear, createBasicPages, createAndPopulateUsersTable, dropUsersTable, buildConfig } = require('./helper')
const whyIsNodeRuninng = require('why-is-node-running')
const { test } = require('tap')
const { buildServer } = require('..')
const { request } = require('undici')
const { rm } = require('fs/promises')
const path = require('path')

test('starts the dashboard', async ({ teardown, equal, pass, same }) => {
  const app = await buildServer(buildConfig({
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    db: {
      ...connInfo
    },
    dashboard: {
      path: '/dashboard'
    }
  }))

  teardown(async () => {
    await app.close()
  })
  await app.start()

  {
    const res = await (request(`${app.url}/dashboard`))
    equal(res.statusCode, 200, 'dashboard status code')
  }
})

test('should not restart if not authorized', async ({ teardown, equal, same }) => {
  const app = await buildServer(buildConfig({
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    dashboard: true,
    db: {
      ...connInfo
    }
  }))

  teardown(async () => {
    await app.close()
  })
  await app.start()

  const res = await (request(`${app.url}/_admin/restart`, {
    method: 'POST'
  }))
  equal(res.statusCode, 400)
  same(await res.body.json(), {
    code: 'FST_ERR_VALIDATION',
    statusCode: 400,
    error: 'Bad Request',
    message: 'headers must have required property \'x-platformatic-admin-secret\''
  })
})

test('restarts the server', async ({ teardown, equal, pass, same, match }) => {
  const app = await buildServer(buildConfig({
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    dashboard: true,
    db: {
      ...connInfo,
      async onDatabaseLoad (db, sql) {
        await dropUsersTable(db, sql)
        await createAndPopulateUsersTable(db, sql)
      }
    },
    authorization: {
      adminSecret: 'secret',
      rules: [{
        role: 'platformatic-admin',
        entity: 'user',
        find: true
      }]
    }
  }))

  teardown(async () => {
    await app.close()
  })
  await app.start()

  {
    const res = await (request(`${app.url}/_admin/restart`, {
      method: 'POST',
      headers: {
        'x-platformatic-admin-secret': 'secret'
      }
    }))
    equal(res.statusCode, 200, 'restart status code')
    same(await res.body.json(), {
      success: true
    })
  }

  {
    // query users and get data
    const res = await request(`${app.url}/graphql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-PLATFORMATIC-ADMIN-SECRET': 'secret'
      },
      body: JSON.stringify({
        query: `
          query {
            users {
              name
              age
            }
          }
        `
      })
    })
    const body = await res.body.json()
    equal(res.statusCode, 200)
    same(body, {
      data: {
        users: [{
          name: 'Leonardo',
          age: 40
        }, {
          name: 'Matteo',
          age: 37
        }]
      }
    })
  }
})

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
    dashboard: {
      path: '/dashboard'
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
    const res = await (request(`${app.url}/dashboard`))
    equal(res.statusCode, 200, 'dashboard status code')
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
  }
})

setInterval(() => {
  whyIsNodeRuninng()
}, 5000).unref()
