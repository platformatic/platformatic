'use strict'

const { test } = require('tap')
const fastify = require('fastify')
const core = require('@platformatic/db-core')
const { connInfo, clear, isSQLite, isMysql } = require('./helper')
const auth = require('..')

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

async function createPagesWithTimestamp (db, sql) {
  if (isSQLite) {
    await db.query(sql`CREATE TABLE pages (
      id INTEGER PRIMARY KEY,
      title VARCHAR(42),
      edited_at TIMESTAMP,
      user_id INTEGER
    );`)
  } else if (isMysql) {
    await db.query(sql`CREATE TABLE pages (
      id SERIAL PRIMARY KEY,
      title VARCHAR(42),
      edited_at TIMESTAMP NULL DEFAULT NULL,
      user_id INTEGER
    );`)
  } else {
    await db.query(sql`CREATE TABLE pages (
      id SERIAL PRIMARY KEY,
      title VARCHAR(42),
      edited_at TIMESTAMP,
      user_id INTEGER
    );`)
  }
}

test('users can save and update their own pages, read everybody\'s and delete none', async ({ pass, teardown, same, equal, match, plan }) => {
  plan(27)
  const app = fastify()
  app.register(core, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      pass('onDatabaseLoad called')

      await clear(db, sql)
      await createBasicPages(db, sql)
    }
  })
  const generated = [42, 42, 43, 42, 42, 42]
  app.register(auth, {
    jwt: {
      secret: 'supersecret'
    },
    roleKey: 'X-PLATFORMATIC-ROLE',
    anonymousRole: 'anonymous',
    rules: [{
      role: 'user',
      entity: 'page',
      async find ({ user, ctx, where }) {
        return {
          ...where,
          userId: {
            eq: user['X-PLATFORMATIC-USER-ID']
          }
        }
      },
      async delete ({ user, ctx, where }) {
        return {
          ...where,
          userId: {
            eq: user['X-PLATFORMATIC-USER-ID']
          }
        }
      },
      defaults: {
        userId: async function ({ user, ctx, input }) {
          match(user, {
            'X-PLATFORMATIC-USER-ID': generated.shift(),
            'X-PLATFORMATIC-ROLE': 'user'
          })

          return user['X-PLATFORMATIC-USER-ID']
        }

      },
      async save ({ user, ctx, where }) {
        return {
          ...where,
          userId: {
            eq: user['X-PLATFORMATIC-USER-ID']
          }
        }
      }
    }]
  })
  teardown(app.close.bind(app))

  await app.ready()

  const token = await app.jwt.sign({
    'X-PLATFORMATIC-USER-ID': 42,
    'X-PLATFORMATIC-ROLE': 'user'
  })

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: {
        Authorization: `Bearer ${token}`
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
    same(res.json(), {
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
        Authorization: `Bearer ${token}`
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
    same(res.json(), {
      data: {
        getPageById: {
          id: 1,
          title: 'Hello',
          userId: 42
        }
      }
    }, 'pages response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: {
        Authorization: `Bearer ${token}`
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
    same(res.json(), {
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
        Authorization: `Bearer ${token}`
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
    same(res.json(), {
      data: {
        getPageById: {
          id: 1,
          title: 'Hello World'
        }
      }
    }, 'pages response')
  }

  const token2 = await app.jwt.sign({
    'X-PLATFORMATIC-USER-ID': 43,
    'X-PLATFORMATIC-ROLE': 'user'
  })

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: {
        Authorization: `Bearer ${token2}`
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
    same(res.json(), {
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
        Authorization: `Bearer ${token2}`
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
    same(res.json(), {
      data: {
        getPageById: null
      }
    }, 'pages response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: {
        query: `
          mutation batch($inputs : [PageInput]!) {
            insertPages (inputs: $inputs) {
              id
              title,
              userId
            }
          }
        `,
        variables: {
          inputs: [
            { title: 'Page 1' },
            { title: 'Page 2' },
            { title: 'Page 3' }
          ]
        }
      }
    })
    equal(res.statusCode, 200, 'savePage status code')
    same(res.json(), {
      data: {
        insertPages: [
          { id: 2, title: 'Page 1', userId: 42 },
          { id: 3, title: 'Page 2', userId: 42 },
          { id: 4, title: 'Page 3', userId: 42 }
        ]
      }
    }, 'savePage response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: {
        Authorization: `Bearer ${token2}`
      },
      body: {
        query: `
          mutation {
            deletePages(where: { title: { eq: "Hello World" } }) {
              id
              title
            }
          }
        `
      }
    })
    equal(res.statusCode, 200, 'deletePages status code')
    same(res.json(), {
      data: {
        deletePages: []
      }
    })
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: {
        query: `
          mutation {
            deletePages(where: { title: { eq: "Hello World" } }) {
              id
              title
            }
          }
        `
      }
    })
    equal(res.statusCode, 200, 'deletePages status code')
    same(res.json(), {
      data: {
        deletePages: [{
          id: 1,
          title: 'Hello World'
        }]
      }
    })
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: {
        Authorization: `Bearer ${token}`
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
    same(res.json(), {
      data: {
        getPageById: null
      }
    }, 'pages response')
  }
})

test('user can delete all post written before yesterday', async ({ pass, teardown, same, equal, match, plan }) => {
  // plan(27)
  const app = fastify()
  app.register(core, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      pass('onDatabaseLoad called')
      await clear(db, sql)
      await createPagesWithTimestamp(db, sql)
    }
  })
  const userId = 42
  const yesterday = (new Date(Date.now() - 60 * 60 * 24 * 1000)).toISOString()
  const twoHoursAgo = (new Date(Date.now() - 60 * 60 * 2 * 1000)).toISOString()
  const twentySixHoursAgo = (new Date(Date.now() - 60 * 60 * 26 * 1000)).toISOString()

  app.register(auth, {
    jwt: {
      secret: 'supersecret'
    },
    roleKey: 'X-PLATFORMATIC-ROLE',
    anonymousRole: 'anonymous',
    rules: [{
      role: 'user',
      entity: 'page',
      find: true,
      save: true,
      async delete ({ user, ctx, where }) {
        return {
          ...where,
          editedAt: {
            lt: yesterday
          }
        }
      },
      defaults: {
        userId: 'X-PLATFORMATIC-USER-ID'
      }
    }]
  })
  teardown(app.close.bind(app))

  await app.ready()

  // that is: 24 * 60 * 60 * 1000
  const token = await app.jwt.sign({
    'X-PLATFORMATIC-USER-ID': userId,
    'X-PLATFORMATIC-ROLE': 'user'
  })

  // Inserts a page edited 2 hours ago
  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: {
        query: `
          mutation {
            savePage(input: { title: "Hello", editedAt: "${twoHoursAgo}" }) {
              id
              title
              userId
              editedAt
            }
          }
        `
      }
    })
    equal(res.statusCode, 200, 'savePage status code')
    same(res.json(), {
      data: {
        savePage: {
          id: 1,
          title: 'Hello',
          userId,
          editedAt: twoHoursAgo
        }
      }
    }, 'savePage response')
  }

  // Inserts a page edited 26 hours ago (so yesterday)
  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: {
        query: `
          mutation {
            savePage(input: { title: "Hello", editedAt: "${twentySixHoursAgo}" }) {
              id
              title
              userId
              editedAt
            }
          }
        `
      }
    })
    equal(res.statusCode, 200, 'savePage status code')
    same(res.json(), {
      data: {
        savePage: {
          id: 2,
          title: 'Hello',
          userId,
          editedAt: twentySixHoursAgo
        }
      }
    }, 'savePage response')
  }
  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: {
        query: `
          query {
            pages(where: { title: { eq: "Hello" } }) {
              id
              title
              userId
              editedAt
            }
          }
        `
      }
    })
    equal(res.statusCode, 200, 'pages status code')
    same(res.json(), {
      data: {
        pages: [{
          id: 1,
          title: 'Hello',
          userId,
          editedAt: twoHoursAgo
        }, {
          id: 2,
          title: 'Hello',
          userId,
          editedAt: twentySixHoursAgo
        }]
      }
    }, 'pages response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: {
        query: `
          mutation {
            deletePages(where: { title: { eq: "Hello" } }) {
              id
              title
            }
          }
        `
      }
    })
    equal(res.statusCode, 200, 'deletePages status code')
    same(res.json(), {
      data: {
        deletePages: [{
          id: 2,
          title: 'Hello'
        }]
      }
    })
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: {
        query: `
          query {
            pages {
              id
              title
              userId
              editedAt
            }
          }
        `
      }
    })
    equal(res.statusCode, 200, 'pages status code')
    same(res.json(), {
      data: {
        pages: [{
          id: 1,
          title: 'Hello',
          userId,
          editedAt: twoHoursAgo
        }]
      }
    }, 'pages response')
  }
})
