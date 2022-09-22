'use strict'

const { connInfo, clear, createBasicPages, createAndPopulateUsersTable, dropUsersTable, buildConfig } = require('./helper')
const whyIsNodeRuninng = require('why-is-node-running')
const { test } = require('tap')
const { buildServer } = require('..')
const { request } = require('undici')
const { rm } = require('fs/promises')
const path = require('path')

test('starts the dashboard', async ({ teardown, equal, pass, same }) => {
  const server = await buildServer(buildConfig({
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    core: {
      ...connInfo
    },
    dashboard: {
      enabled: true,
      rootPath: true
    }
  }))
  teardown(server.stop)
  await server.listen()
  {
    const res = await (request(`${server.url}/dashboard`))
    equal(res.statusCode, 200, 'dashboard status code')
  }
})

test('should not restart if not authorized', async ({ teardown, equal, same }) => {
  const server = await buildServer(buildConfig({
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    core: {
      ...connInfo
    }
  }))
  teardown(server.stop)

  await server.listen()
  const res = await (request(`${server.url}/_admin/restart`, {
    method: 'POST'
  }))
  equal(res.statusCode, 400)
  same(await res.body.json(), {
    statusCode: 400,
    error: 'Bad Request',
    message: 'headers must have required property \'x-platformatic-admin-secret\''
  })
})

test('restarts the server', async ({ teardown, equal, pass, same, match }) => {
  let dbHandler, sqlHandler
  let started = false
  const server = await buildServer(buildConfig({
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    core: {
      ...connInfo,
      async onDatabaseLoad (db, sql) {
        if (!started) {
          await dropUsersTable(db, sql)
        }
        started = true
        dbHandler = db
        sqlHandler = sql
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
  teardown(server.stop)

  await server.listen()

  {
    // query users and get an error
    const res = await request(`${server.url}/graphql`, {
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
    equal(res.statusCode, 400)
    equal(body.errors.length, 1)
    match(body.errors[0].message, 'Cannot query field "users" on type "Query".')
  }

  // Create users table
  await createAndPopulateUsersTable(dbHandler, sqlHandler)

  {
    const res = await (request(`${server.url}/_admin/restart`, {
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
    const res = await request(`${server.url}/graphql`, {
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
  const server = await buildServer(buildConfig({
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    core: {
      ...connInfo,
      async onDatabaseLoad (db, sql) {
        pass('onDatabaseLoad called')

        await clear(db, sql)
        await createBasicPages(db, sql)
      }
    }
  }))
  teardown(server.stop)
  await server.listen()

  {
    const res = await request(`${server.url}/graphql`, {
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
    const res = await request(`${server.url}/graphql`, {
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
    const res = await request(`${server.url}/graphql`, {
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
    const res = await request(`${server.url}/graphql`, {
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
  const { inject, stop } = await buildServer(buildConfig({
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    core: {
      ...connInfo,
      async onDatabaseLoad (db, sql) {
        pass('onDatabaseLoad called')

        await clear(db, sql)
        await createBasicPages(db, sql)
      }
    }
  }))
  teardown(stop)

  {
    const res = await inject({
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
  const dbLocation = path.posix.join(__dirname, '..', 'fixtures', 'sqlite', 'db')
  const migrations = path.posix.join(__dirname, '..', 'fixtures', 'sqlite', 'migrations')
  try {
    await rm(dbLocation)
  } catch {
    // ignore
  }
  const server = await buildServer(buildConfig({
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    core: {
      connectionString: `sqlite://${dbLocation}`
    },
    dashboard: {
      enabled: true,
      rootPath: true
    },
    migrations: {
      dir: migrations
    }
  }))
  teardown(server.stop)
  await server.listen()
  {
    const res = await (request(`${server.url}/dashboard`))
    equal(res.statusCode, 200, 'dashboard status code')
  }
})

setInterval(() => {
  whyIsNodeRuninng()
}, 5000).unref()
