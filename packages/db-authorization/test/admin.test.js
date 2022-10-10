'use strict'

const { test } = require('tap')
const fastify = require('fastify')
const core = require('@platformatic/db-core')
const { connInfo, clear, isSQLite } = require('./helper')
const auth = require('..')
const { request } = require('undici')

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

test('admin can do impersonate a users', async ({ pass, teardown, same, equal }) => {
  const app = fastify()
  const adminSecret = require('crypto').randomUUID()
  app.register(core, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      pass('onDatabaseLoad called')

      await clear(db, sql)
      await createBasicPages(db, sql)
    }
  })
  app.register(auth, {
    adminSecret,
    roleKey: 'X-PLATFORMATIC-ROLE',
    anonymousRole: 'anonymous',
    rules: [{
      role: 'user',
      entity: 'page',
      delete: false,
      defaults: {
        userId: 'X-PLATFORMATIC-USER-ID'
      },
      find: {
        checks: {
          userId: 'x-platformatic-user-id'
        }
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
  teardown(app.close.bind(app))

  await app.ready()

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: {
        'X-PLATFORMATIC-ADMIN-SECRET': adminSecret,
        'X-PLATFORMATIC-USER-ID': 42,
        'X-PLATFORMATIC-ROLE': 'user'
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
        'X-PLATFORMATIC-ADMIN-SECRET': adminSecret,
        'X-PLATFORMATIC-USER-ID': 42,
        'X-PLATFORMATIC-ROLE': 'user'
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
        'X-PLATFORMATIC-ADMIN-SECRET': adminSecret,
        'X-PLATFORMATIC-USER-ID': 42,
        'X-PLATFORMATIC-ROLE': 'user'
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
        'X-PLATFORMATIC-ADMIN-SECRET': adminSecret,
        'X-PLATFORMATIC-USER-ID': 42,
        'X-PLATFORMATIC-ROLE': 'user'
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

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: {
        'X-PLATFORMATIC-ADMIN-SECRET': adminSecret,
        'X-PLATFORMATIC-USER-ID': 43,
        'X-PLATFORMATIC-ROLE': 'user'
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
        'X-PLATFORMATIC-ADMIN-SECRET': adminSecret,
        'X-PLATFORMATIC-USER-ID': 43,
        'X-PLATFORMATIC-ROLE': 'user'
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
        'X-PLATFORMATIC-ADMIN-SECRET': adminSecret,
        'X-PLATFORMATIC-USER-ID': 42,
        'X-PLATFORMATIC-ROLE': 'user'
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
        'X-PLATFORMATIC-ADMIN-SECRET': adminSecret,
        'X-PLATFORMATIC-USER-ID': 42,
        'X-PLATFORMATIC-ROLE': 'user'
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

test('only admin usage', async ({ pass, teardown, same, equal }) => {
  const app = fastify()
  const adminSecret = require('crypto').randomUUID()
  app.register(core, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      pass('onDatabaseLoad called')

      await clear(db, sql)
      await createBasicPages(db, sql)
    }
  })
  app.register(auth, {
    adminSecret,
    roleKey: 'X-PLATFORMATIC-ROLE',
    anonymousRole: 'anonymous',
    rules: [{
      role: 'user',
      entity: 'page',
      delete: false,
      defaults: {
        userId: 'X-PLATFORMATIC-USER-ID'
      },
      find: {
        checks: {
          userId: 'x-platformatic-user-id'
        }
      },
      save: {
        checks: { userId: 'X-PLATFORMATIC-USER-ID' }
      }
    }, {
      role: 'anonymous',
      entity: 'page',
      find: false,
      delete: false,
      save: false
    }]
  })
  teardown(app.close.bind(app))

  await app.ready()

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: {
        'X-PLATFORMATIC-ADMIN-SECRET': adminSecret,
        'X-PLATFORMATIC-USER-ID': 42,
        'X-PLATFORMATIC-ROLE': 'user'
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
        'X-PLATFORMATIC-ADMIN-SECRET': adminSecret,
        'X-PLATFORMATIC-USER-ID': 42,
        'X-PLATFORMATIC-ROLE': 'user'
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
        'X-PLATFORMATIC-ADMIN-SECRET': adminSecret,
        'X-PLATFORMATIC-USER-ID': 42,
        'X-PLATFORMATIC-ROLE': 'user'
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
        'X-PLATFORMATIC-ADMIN-SECRET': adminSecret,
        'X-PLATFORMATIC-USER-ID': 42,
        'X-PLATFORMATIC-ROLE': 'user'
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

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: {
        'X-PLATFORMATIC-ADMIN-SECRET': adminSecret,
        'X-PLATFORMATIC-USER-ID': 43,
        'X-PLATFORMATIC-ROLE': 'user'
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
        'X-PLATFORMATIC-ADMIN-SECRET': adminSecret,
        'X-PLATFORMATIC-USER-ID': 43,
        'X-PLATFORMATIC-ROLE': 'user'
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
        'X-PLATFORMATIC-ADMIN-SECRET': adminSecret,
        'X-PLATFORMATIC-USER-ID': 42,
        'X-PLATFORMATIC-ROLE': 'user'
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
        'X-PLATFORMATIC-ADMIN-SECRET': adminSecret,
        'X-PLATFORMATIC-USER-ID': 42,
        'X-PLATFORMATIC-ROLE': 'user'
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

test('platformatic-admin role', async ({ pass, teardown, same, equal }) => {
  const app = fastify()
  const adminSecret = require('crypto').randomUUID()
  app.register(core, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      pass('onDatabaseLoad called')

      await clear(db, sql)
      await createBasicPages(db, sql)
    }
  })
  app.register(auth, {
    adminSecret
  })
  teardown(app.close.bind(app))

  await app.ready()

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: {
        'X-PLATFORMATIC-ADMIN-SECRET': adminSecret
      },
      body: {
        query: `
          mutation {
            savePage(input: { title: "Hello" }) {
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
          title: 'Hello'
        }
      }
    }, 'savePage response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: {
        'X-PLATFORMATIC-ADMIN-SECRET': adminSecret
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
          title: 'Hello'
        }
      }
    }, 'pages response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: {
        'X-PLATFORMATIC-ADMIN-SECRET': adminSecret
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
        'X-PLATFORMATIC-ADMIN-SECRET': adminSecret
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

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
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
        'X-PLATFORMATIC-ADMIN-SECRET': adminSecret
      },
      body: {
        query: `
          mutation batch($inputs : [PageInput]!) {
            insertPages (inputs: $inputs) {
              id
              title
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
          { id: 2, title: 'Page 1' },
          { id: 3, title: 'Page 2' },
          { id: 4, title: 'Page 3' }
        ]
      }
    }, 'savePage response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: {
        'X-PLATFORMATIC-ADMIN-SECRET': adminSecret
      },
      body: {
        query: `
          mutation {
            deletePages(where: { title: { eq: "Page 1" } }) {
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
          title: 'Page 1'
        }]
      }
    }, 'deletePages response')
  }
})

test('admin with no rules', async ({ pass, teardown, same, equal }) => {
  const app = fastify()
  const adminSecret = require('crypto').randomUUID()
  app.register(core, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      pass('onDatabaseLoad called')

      await clear(db, sql)
      await createBasicPages(db, sql)
    }
  })
  app.register(auth, {
    adminSecret
  })
  teardown(app.close.bind(app))

  await app.ready()

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: {
        'X-PLATFORMATIC-ADMIN-SECRET': adminSecret
      },
      body: {
        query: `
          mutation {
            savePage(input: { title: "Hello" }) {
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
          title: 'Hello'
        }
      }
    }, 'savePage response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: {
        'X-PLATFORMATIC-ADMIN-SECRET': adminSecret
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
    equal(res.statusCode, 200, 'getPageById status code')
    same(res.json(), {
      data: {
        getPageById: {
          id: 1,
          title: 'Hello'
        }
      }
    }, 'getPageById response')
  }
})

test('platformatic-admin has lower priority to allow user impersonation', async ({ pass, teardown, same, equal }) => {
  const app = fastify()
  const adminSecret = require('crypto').randomUUID()
  app.register(core, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      pass('onDatabaseLoad called')

      await clear(db, sql)
      await createBasicPages(db, sql)
    }
  })
  app.register(auth, {
    adminSecret,
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
  teardown(app.close.bind(app))

  await app.ready()

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: {
        'X-PLATFORMATIC-ADMIN-SECRET': adminSecret,
        'X-PLATFORMATIC-USER-ID': 42,
        'X-PLATFORMATIC-ROLE': ['user', 'platformatic-admin']
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
        'X-PLATFORMATIC-ADMIN-SECRET': adminSecret,
        'X-PLATFORMATIC-USER-ID': 42,
        'X-PLATFORMATIC-ROLE': ['user', 'platformatic-admin']
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

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: {
        'X-PLATFORMATIC-ADMIN-SECRET': adminSecret,
        'X-PLATFORMATIC-USER-ID': 42,
        'X-PLATFORMATIC-ROLE': ['platformatic-admin']
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
          id: 1,
          title: 'Hello'
        }]
      }
    }, 'deletePages response')
  }
})

test('adminSecret is disabled if jwt is set', async ({ pass, teardown, same, equal }) => {
  const app = fastify()
  const adminSecret = require('crypto').randomUUID()
  app.register(core, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      pass('onDatabaseLoad called')

      await clear(db, sql)
      await createBasicPages(db, sql)
    }
  })
  app.register(auth, {
    jwt: {
      secret: 'supersecret'
    },
    adminSecret,
    roleKey: 'X-PLATFORMATIC-ROLE',
    anonymousRole: 'anonymous',
    rules: [{
      role: 'platformatic-admin',
      entity: 'page',
      find: true,
      delete: true,
      save: true
    }, {
      role: 'anonymous',
      entity: 'page',
      find: false,
      delete: false,
      save: false
    }]
  })
  teardown(app.close.bind(app))

  await app.ready()
  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: {
        'X-PLATFORMATIC-ADMIN-SECRET': adminSecret
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

test('adminSecret is disabled if webhook is set', async ({ pass, teardown, same, equal }) => {
  async function buildAuthorizer (opts = {}) {
    // We need forceCloseConnection otherwise the test will hang with node16
    const app = fastify({ forceCloseConnections: true })
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

  const app = fastify()
  const adminSecret = require('crypto').randomUUID()
  app.register(core, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      pass('onDatabaseLoad called')

      await clear(db, sql)
      await createBasicPages(db, sql)
    }
  })

  const authorizer = await buildAuthorizer()
  app.register(auth, {
    webhook: {
      url: `http://localhost:${authorizer.server.address().port}/authorize`
    },
    adminSecret,
    roleKey: 'X-PLATFORMATIC-ROLE',
    anonymousRole: 'anonymous',
    rules: [{
      role: 'platformatic-admin',
      entity: 'page',
      find: true,
      delete: true,
      save: true
    }, {
      role: 'anonymous',
      entity: 'page',
      find: false,
      delete: false,
      save: false
    }]
  })
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
  teardown(app.close.bind(app))
  teardown(() => authorizer.close())

  const cookie = await getCookie(42, 'user')
  await app.ready()
  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: {
        cookie,
        'X-PLATFORMATIC-ADMIN-SECRET': adminSecret
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
