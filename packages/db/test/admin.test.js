'use strict'

const { buildConfig, connInfo, clear, createBasicPages } = require('./helper')
const { test } = require('tap')
const { buildServer } = require('..')
const { request } = require('undici')

test('adminSecret', async ({ teardown, equal, pass, same }) => {
  const server = await buildServer(buildConfig({
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    authorization: {
      adminSecret: 'secret'
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
      headers: {
        'Content-Type': 'application/json',
        'X-PLATFORMATIC-ADMIN-SECRET': 'secret'
      },
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
      headers: {
        'Content-Type': 'application/json',
        'X-PLATFORMATIC-ADMIN-SECRET': 'secret'
      },
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
      headers: {
        'Content-Type': 'application/json',
        'X-PLATFORMATIC-ADMIN-SECRET': 'secret'
      },
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
      headers: {
        'Content-Type': 'application/json',
        'X-PLATFORMATIC-ADMIN-SECRET': 'secret'
      },
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

  {
    const res = await request(`${server.url}/graphql`, {
      method: 'POST',
      url: '/graphql',
      headers: {
        'Content-Type': 'application/json',
        'X-PLATFORMATIC-ADMIN-SECRET': 'wrong'
      },
      body: JSON.stringify({
        query: `
          mutation {
            deletePages(where: { title: { eq: "Hello" } }) {
              id
              title
            }
          }
        `
      })
    })
    equal(res.statusCode, 200, 'deletePages status code')
    same(await res.body.json(), {
      data: {
        deletePages: null
      },
      errors: [
        {
          message: 'operation not allowed',
          locations: [
            {
              line: 3,
              column: 13
            }
          ],
          path: [
            'deletePages'
          ]
        }
      ]
    }, 'deletePages response')
  }
})
test('login route', async ({ teardown, same, equal }) => {
  const server = await buildServer(buildConfig({
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    authorization: {
      adminSecret: 'secret'
    },
    core: {
      ...connInfo
    }
  }))
  teardown(server.stop)
  await server.listen()
  {
    // right password provided
    const res = await request(`${server.url}/_admin/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        password: 'secret'
      })
    })
    equal(res.statusCode, 200)
    same(await res.body.json(), {
      authorized: true
    })
  }

  {
    // bad password provided
    const res = await request(`${server.url}/_admin/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        password: 'this-is-not-the-right-password'
      })
    })
    equal(res.statusCode, 401)
    same(await res.body.json(), {
      authorized: false
    })
  }

  {
    // no password provided
    const res = await request(`${server.url}/_admin/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    })
    equal(res.statusCode, 400)
    same(await res.body.json(), {
      statusCode: 400,
      error: 'Bad Request',
      message: 'body must have required property \'password\''
    })
  }
})

test('Swagger documentation', async ({ teardown, same, equal }) => {
  const server = await buildServer(buildConfig({
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    authorization: {
      adminSecret: 'secret'
    },
    core: {
      ...connInfo
    }
  }))
  teardown(server.stop)
  await server.listen()

  {
    // JSON Documentation
    const res = await request(`${server.url}/_admin/documentation/json`)
    equal(res.statusCode, 200)
    const body = await res.body.json()

    equal(body.openapi, '3.0.3')
    same(body.info, {
      title: 'Platformatic DB Admin Routes',
      description: 'Configure and manage your Platformatic DB instance.'
    })

    same(Object.keys(body.paths), [
      '/_admin/config',
      '/_admin/login',
      '/_admin/restart',
      '/_admin/config-file'
    ])
  }

  {
    // HTML Documentation
    const res = await request(`${server.url}/_admin/documentation/static/index.html`)
    equal(res.statusCode, 200)
    equal(res.headers['content-type'], 'text/html; charset=UTF-8')
  }
})

test('admin routes are not included in main openapi', async ({ teardown, same, equal }) => {
  const server = await buildServer(buildConfig({
    server: {
      hostname: '127.0.0.1',
      port: 0
    },
    authorization: {
      adminSecret: 'secret'
    },
    core: {
      ...connInfo,
      async onDatabaseLoad (db, sql) {
        await clear(db, sql)
        await createBasicPages(db, sql)
      }
    }
  }))
  teardown(server.stop)
  await server.listen()

  {
    // JSON Documentation
    const res = await request(`${server.url}/documentation/json`)
    equal(res.statusCode, 200)
    const body = await res.body.json()

    equal(body.openapi, '3.0.3')

    same(Object.keys(body.paths), [
      '/pages/',
      '/pages/{id}',
      '/'
    ])
  }
})
