'use strict'

const fastify = require('fastify')
const auth = require('..')
const { test } = require('node:test')
const { tspl } = require('@matteo.collina/tspl')
const core = require('@platformatic/db-core')
const { connInfo, clear, isSQLite } = require('./helper')
const { request, Agent, setGlobalDispatcher } = require('undici')

const agent = new Agent({
  keepAliveTimeout: 10,
  keepAliveMaxTimeout: 10
})
setGlobalDispatcher(agent)

async function buildAuthorizer (opts = {}) {
  const app = fastify()
  app.register(require('@fastify/cookie'))
  app.register(require('@fastify/session'), {
    cookieName: 'sessionId',
    secret: 'a secret with minimum length of 32 characters',
    cookie: { secure: false }
  })

  app.post('/login', async (request, reply) => {
    request.session.user = request.body
    return {
      status: 'ok'
    }
  })

  app.post('/authorize', async (request, reply) => {
    if (typeof opts.onAuthorize === 'function') {
      await opts.onAuthorize(request)
    }

    const user = request.session.user
    if (!user) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }
    return user
  })

  await app.listen({ port: 0 })

  return app
}

async function createBasicPages (db, sql) {
  if (isSQLite) {
    await db.query(sql`CREATE TABLE pages (
      id INTEGER PRIMARY KEY,
      title VARCHAR(42),
      user_id INTEGER
    );`)
  } else {
    await db.query(sql`CREATE TABLE pages (
      id SERIAL PRIMARY KEY,
      title VARCHAR(42),
      user_id INTEGER
    );`)
  }
}

test('users can save and update their own pages, read everybody\'s and delete none', async (t) => {
  const { equal, deepEqual, ok } = tspl(t, { plan: 11 })

  const authorizer = await buildAuthorizer()
  const app = fastify()
  app.register(core, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      ok('onDatabaseLoad called')

      await clear(db, sql)
      await createBasicPages(db, sql)
    }
  })
  app.register(auth, {
    webhook: {
      url: `http://localhost:${authorizer.server.address().port}/authorize`
    },
    roleKey: 'X-PLATFORMATIC-ROLE',
    anonymousRole: 'anonymous',
    rules: [{
      role: 'user',
      entity: 'page',
      find: true,
      delete: false,
      defaults: {
        userId: 'X-PLATFORMATIC-USER-ID'
      },
      save: {
        checks: {
          userId: 'X-PLATFORMATIC-USER-ID'
        }
      }
    }, {
      role: 'anonymous',
      entity: 'page',
      find: false,
      delete: false,
      save: false
    }]
  })
  test.after(() => {
    app.close()
  })
  test.after(() => authorizer.close())

  await app.ready()

  async function getCookie (userId, role) {
    const res = await request(`http://localhost:${authorizer.server.address().port}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        'X-PLATFORMATIC-USER-ID': userId,
        'X-PLATFORMATIC-ROLE': role
      })
    })

    res.body.resume()

    const cookie = res.headers['set-cookie'].split(';')[0]
    return cookie
  }

  const cookie = await getCookie(42, 'user')

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: {
        cookie
      },
      body: {
        query: `
          mutation {
            savePage(input: { title: "Hello" }) {
              id
              title
              userId
            }
          }
        `
      }
    })
    equal(res.statusCode, 200, 'savePage status code')
    deepEqual(res.json(), {
      data: {
        savePage: {
          id: 1,
          title: 'Hello',
          userId: 42
        }
      }
    }, 'savePage response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: {
        cookie
      },
      body: {
        query: `
          query {
            getPageById(id: 1) {
              id
              title
              userId
            }
          }
        `
      }
    })
    equal(res.statusCode, 200, 'pages status code')
    deepEqual(res.json(), {
      data: {
        getPageById: {
          id: 1,
          title: 'Hello',
          userId: 42
        }
      }
    }, 'pages response')
  }

  // check that works also with a GET request
  {
    const res = await app.inject({
      method: 'GET',
      url: '/pages',
      headers: {
        cookie
      }
    })
    equal(res.statusCode, 200, 'pages status code')
    deepEqual(res.json(), [{
      id: 1,
      title: 'Hello',
      userId: 42
    }]
    , 'pages response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: {
        cookie
      },
      body: {
        query: `
          mutation {
            savePage(input: { id: 1, title: "Hello World" }) {
              id
              title
            }
          }
        `
      }
    })
    equal(res.statusCode, 200, 'savePage status code')
    deepEqual(res.json(), {
      data: {
        savePage: {
          id: 1,
          title: 'Hello World'
        }
      }
    }, 'savePage response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: {
        cookie
      },
      body: {
        query: `
          query {
            getPageById(id: 1) {
              id
              title
            }
          }
        `
      }
    })
    equal(res.statusCode, 200, 'pages status code')
    deepEqual(res.json(), {
      data: {
        getPageById: {
          id: 1,
          title: 'Hello World'
        }
      }
    }, 'pages response')
  }
})

test('Non-200 status code', async (t) => {
  const { equal, deepEqual, ok } = tspl(t, { plan: 6 })

  const authorizer = await buildAuthorizer({
    onAuthorize: async (request) => {
      if (request.headers['x-status-code']) {
        ok('authorizer called, throwing exception')
        const err = new Error('Unauthorized')
        err.statusCode = request.headers['X-STATUS-CODE']
        throw err
      }
    }
  })
  const app = fastify()
  app.register(core, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      ok('onDatabaseLoad called')

      await clear(db, sql)
      await createBasicPages(db, sql)
    }
  })
  app.register(auth, {
    webhook: {
      url: `http://localhost:${authorizer.server.address().port}/authorize`
    },
    roleKey: 'X-PLATFORMATIC-ROLE',
    anonymousRole: 'anonymous',
    rules: [{
      role: 'user',
      entity: 'page',
      find: true,
      delete: false,
      defaults: {
        userId: 'X-PLATFORMATIC-USER-ID'
      },
      save: {
        checks: {
          userId: 'X-PLATFORMATIC-USER-ID'
        }
      }
    }, {
      role: 'anonymous',
      entity: 'page',
      find: false,
      delete: false,
      save: false
    }]
  })
  test.after(() => {
    app.close()
  })
  test.after(() => authorizer.close())

  await app.ready()

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
          mutation {
            savePage(input: { title: "Hello" }) {
              id
              title
              userId
            }
          }
        `
      }
    })
    equal(res.statusCode, 200, 'savePage status code')
    deepEqual(res.json(), {
      data: {
        savePage: null
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
            'savePage'
          ]
        }
      ]
    }, 'savePage response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: {
        'X-STATUS-CODE': '403'
      },
      body: {
        query: `
          mutation {
            savePage(input: { title: "Hello" }) {
              id
              title
              userId
            }
          }
        `
      }
    })
    equal(res.statusCode, 200, 'savePage status code')
    deepEqual(res.json(), {
      data: {
        savePage: null
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
            'savePage'
          ]
        }
      ]
    }, 'savePage response')
  }
})
