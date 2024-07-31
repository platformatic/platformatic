'use strict'

const { test } = require('node:test')
const { deepEqual, equal, ok } = require('assert')
const fastify = require('fastify')
const core = require('@platformatic/db-core')
const { connInfo, clear, createBasicPages } = require('./helper')
const auth = require('..')
const { request } = require('undici')

test('admin can impersonate a users', async () => {
  const app = fastify()
  const adminSecret = require('crypto').randomUUID()
  app.register(core, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      ok('onDatabaseLoad called')

      await clear(db, sql)
      await createBasicPages(db, sql)
    },
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
        userId: 'X-PLATFORMATIC-USER-ID',
      },
      find: {
        checks: {
          userId: 'x-platformatic-user-id',
        },
      },
      save: {
        checks: {
          userId: 'X-PLATFORMATIC-USER-ID',
        },
      },
    }, {
      role: 'anonymous',
      entity: 'page',
      find: false,
      delete: false,
      save: false,
    }],
  })
  test.after(() => {
    app.close()
  })

  await app.ready()

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: {
        'X-PLATFORMATIC-ADMIN-SECRET': adminSecret,
        'X-PLATFORMATIC-USER-ID': 42,
        'X-PLATFORMATIC-ROLE': 'user',
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
        `,
      },
    })
    equal(res.statusCode, 200, 'savePage status code')
    deepEqual(res.json(), {
      data: {
        savePage: {
          id: 1,
          title: 'Hello',
          userId: 42,
        },
      },
    }, 'savePage response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: {
        'X-PLATFORMATIC-ADMIN-SECRET': adminSecret,
        'X-PLATFORMATIC-USER-ID': 42,
        'X-PLATFORMATIC-ROLE': 'user',
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
        `,
      },
    })
    equal(res.statusCode, 200, 'pages status code')
    deepEqual(res.json(), {
      data: {
        getPageById: {
          id: 1,
          title: 'Hello',
          userId: 42,
        },
      },
    }, 'pages response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: {
        'X-PLATFORMATIC-ADMIN-SECRET': adminSecret,
        'X-PLATFORMATIC-USER-ID': 42,
        'X-PLATFORMATIC-ROLE': 'user',
      },
      body: {
        query: `
          mutation {
            savePage(input: { id: 1, title: "Hello World" }) {
              id
              title
            }
          }
        `,
      },
    })
    equal(res.statusCode, 200, 'savePage status code')
    deepEqual(res.json(), {
      data: {
        savePage: {
          id: 1,
          title: 'Hello World',
        },
      },
    }, 'savePage response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: {
        'X-PLATFORMATIC-ADMIN-SECRET': adminSecret,
        'X-PLATFORMATIC-USER-ID': 42,
        'X-PLATFORMATIC-ROLE': 'user',
      },
      body: {
        query: `
          query {
            getPageById(id: 1) {
              id
              title
            }
          }
        `,
      },
    })
    equal(res.statusCode, 200, 'pages status code')
    deepEqual(res.json(), {
      data: {
        getPageById: {
          id: 1,
          title: 'Hello World',
        },
      },
    }, 'pages response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: {
        'X-PLATFORMATIC-ADMIN-SECRET': adminSecret,
        'X-PLATFORMATIC-USER-ID': 43,
        'X-PLATFORMATIC-ROLE': 'user',
      },
      body: {
        query: `
          mutation {
            savePage(input: { id: 1, title: "Hello World" }) {
              id
              title
            }
          }
        `,
      },
    })
    equal(res.statusCode, 200, 'savePage status code')
    deepEqual(res.json(), {
      data: {
        savePage: null,
      },
      errors: [
        {
          message: 'operation not allowed',
          locations: [
            {
              line: 3,
              column: 13,
            },
          ],
          path: [
            'savePage',
          ],
        },
      ],
    }, 'savePage response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: {
        'X-PLATFORMATIC-ADMIN-SECRET': adminSecret,
        'X-PLATFORMATIC-USER-ID': 43,
        'X-PLATFORMATIC-ROLE': 'user',
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
        `,
      },
    })
    equal(res.statusCode, 200, 'pages status code')
    deepEqual(res.json(), {
      data: {
        getPageById: null,
      },
    }, 'pages response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: {
        'X-PLATFORMATIC-ADMIN-SECRET': adminSecret,
        'X-PLATFORMATIC-USER-ID': 42,
        'X-PLATFORMATIC-ROLE': 'user',
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
            { title: 'Page 3' },
          ],
        },
      },
    })
    equal(res.statusCode, 200, 'savePage status code')
    deepEqual(res.json(), {
      data: {
        insertPages: [
          { id: 2, title: 'Page 1', userId: 42 },
          { id: 3, title: 'Page 2', userId: 42 },
          { id: 4, title: 'Page 3', userId: 42 },
        ],
      },
    }, 'savePage response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: {
        'X-PLATFORMATIC-ADMIN-SECRET': adminSecret,
        'X-PLATFORMATIC-USER-ID': 42,
        'X-PLATFORMATIC-ROLE': 'user',
      },
      body: {
        query: `
          mutation {
            deletePages(where: { title: { eq: "Hello" } }) {
              id
              title
            }
          }
        `,
      },
    })
    equal(res.statusCode, 200, 'deletePages status code')
    deepEqual(res.json(), {
      data: {
        deletePages: null,
      },
      errors: [
        {
          message: 'operation not allowed',
          locations: [
            {
              line: 3,
              column: 13,
            },
          ],
          path: [
            'deletePages',
          ],
        },
      ],
    }, 'deletePages response')
  }
})

test('only admin usage', async () => {
  const app = fastify()
  const adminSecret = require('crypto').randomUUID()
  app.register(core, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      ok('onDatabaseLoad called')

      await clear(db, sql)
      await createBasicPages(db, sql)
    },
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
        userId: 'X-PLATFORMATIC-USER-ID',
      },
      find: {
        checks: {
          userId: 'x-platformatic-user-id',
        },
      },
      save: {
        checks: { userId: 'X-PLATFORMATIC-USER-ID' },
      },
    }, {
      role: 'anonymous',
      entity: 'page',
      find: false,
      delete: false,
      save: false,
    }],
  })
  test.after(() => {
    app.close()
  })

  await app.ready()

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: {
        'X-PLATFORMATIC-ADMIN-SECRET': adminSecret,
        'X-PLATFORMATIC-USER-ID': 42,
        'X-PLATFORMATIC-ROLE': 'user',
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
        `,
      },
    })
    equal(res.statusCode, 200, 'savePage status code')
    deepEqual(res.json(), {
      data: {
        savePage: {
          id: 1,
          title: 'Hello',
          userId: 42,
        },
      },
    }, 'savePage response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: {
        'X-PLATFORMATIC-ADMIN-SECRET': adminSecret,
        'X-PLATFORMATIC-USER-ID': 42,
        'X-PLATFORMATIC-ROLE': 'user',
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
        `,
      },
    })
    equal(res.statusCode, 200, 'pages status code')
    deepEqual(res.json(), {
      data: {
        getPageById: {
          id: 1,
          title: 'Hello',
          userId: 42,
        },
      },
    }, 'pages response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: {
        'X-PLATFORMATIC-ADMIN-SECRET': adminSecret,
        'X-PLATFORMATIC-USER-ID': 42,
        'X-PLATFORMATIC-ROLE': 'user',
      },
      body: {
        query: `
          mutation {
            savePage(input: { id: 1, title: "Hello World" }) {
              id
              title
            }
          }
        `,
      },
    })
    equal(res.statusCode, 200, 'savePage status code')
    deepEqual(res.json(), {
      data: {
        savePage: {
          id: 1,
          title: 'Hello World',
        },
      },
    }, 'savePage response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: {
        'X-PLATFORMATIC-ADMIN-SECRET': adminSecret,
        'X-PLATFORMATIC-USER-ID': 42,
        'X-PLATFORMATIC-ROLE': 'user',
      },
      body: {
        query: `
          query {
            getPageById(id: 1) {
              id
              title
            }
          }
        `,
      },
    })
    equal(res.statusCode, 200, 'pages status code')
    deepEqual(res.json(), {
      data: {
        getPageById: {
          id: 1,
          title: 'Hello World',
        },
      },
    }, 'pages response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: {
        'X-PLATFORMATIC-ADMIN-SECRET': adminSecret,
        'X-PLATFORMATIC-USER-ID': 43,
        'X-PLATFORMATIC-ROLE': 'user',
      },
      body: {
        query: `
          mutation {
            savePage(input: { id: 1, title: "Hello World" }) {
              id
              title
            }
          }
        `,
      },
    })
    equal(res.statusCode, 200, 'savePage status code')
    deepEqual(res.json(), {
      data: {
        savePage: null,
      },
      errors: [
        {
          message: 'operation not allowed',
          locations: [
            {
              line: 3,
              column: 13,
            },
          ],
          path: [
            'savePage',
          ],
        },
      ],
    }, 'savePage response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: {
        'X-PLATFORMATIC-ADMIN-SECRET': adminSecret,
        'X-PLATFORMATIC-USER-ID': 43,
        'X-PLATFORMATIC-ROLE': 'user',
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
        `,
      },
    })
    equal(res.statusCode, 200, 'pages status code')
    deepEqual(res.json(), {
      data: {
        getPageById: null,
      },
    }, 'pages response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: {
        'X-PLATFORMATIC-ADMIN-SECRET': adminSecret,
        'X-PLATFORMATIC-USER-ID': 42,
        'X-PLATFORMATIC-ROLE': 'user',
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
            { title: 'Page 3' },
          ],
        },
      },
    })
    equal(res.statusCode, 200, 'savePage status code')
    deepEqual(res.json(), {
      data: {
        insertPages: [
          { id: 2, title: 'Page 1', userId: 42 },
          { id: 3, title: 'Page 2', userId: 42 },
          { id: 4, title: 'Page 3', userId: 42 },
        ],
      },
    }, 'savePage response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: {
        'X-PLATFORMATIC-ADMIN-SECRET': adminSecret,
        'X-PLATFORMATIC-USER-ID': 42,
        'X-PLATFORMATIC-ROLE': 'user',
      },
      body: {
        query: `
          mutation {
            deletePages(where: { title: { eq: "Hello" } }) {
              id
              title
            }
          }
        `,
      },
    })
    equal(res.statusCode, 200, 'deletePages status code')
    deepEqual(res.json(), {
      data: {
        deletePages: null,
      },
      errors: [
        {
          message: 'operation not allowed',
          locations: [
            {
              line: 3,
              column: 13,
            },
          ],
          path: [
            'deletePages',
          ],
        },
      ],
    }, 'deletePages response')
  }
})

test('platformatic-admin role', async () => {
  const app = fastify()
  const adminSecret = require('crypto').randomUUID()
  app.register(core, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      ok('onDatabaseLoad called')

      await clear(db, sql)
      await createBasicPages(db, sql)
    },
  })
  app.register(auth, {
    adminSecret,
  })
  test.after(() => {
    app.close()
  })

  await app.ready()

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: {
        'X-PLATFORMATIC-ADMIN-SECRET': adminSecret,
      },
      body: {
        query: `
          mutation {
            savePage(input: { title: "Hello" }) {
              id
              title
            }
          }
        `,
      },
    })
    equal(res.statusCode, 200, 'savePage status code')
    deepEqual(res.json(), {
      data: {
        savePage: {
          id: 1,
          title: 'Hello',
        },
      },
    }, 'savePage response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: {
        'X-PLATFORMATIC-ADMIN-SECRET': adminSecret,
      },
      body: {
        query: `
          query {
            getPageById(id: 1) {
              id
              title
            }
          }
        `,
      },
    })
    equal(res.statusCode, 200, 'pages status code')
    deepEqual(res.json(), {
      data: {
        getPageById: {
          id: 1,
          title: 'Hello',
        },
      },
    }, 'pages response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: {
        'X-PLATFORMATIC-ADMIN-SECRET': adminSecret,
      },
      body: {
        query: `
          mutation {
            savePage(input: { id: 1, title: "Hello World" }) {
              id
              title
            }
          }
        `,
      },
    })
    equal(res.statusCode, 200, 'savePage status code')
    deepEqual(res.json(), {
      data: {
        savePage: {
          id: 1,
          title: 'Hello World',
        },
      },
    }, 'savePage response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: {
        'X-PLATFORMATIC-ADMIN-SECRET': adminSecret,
      },
      body: {
        query: `
          query {
            getPageById(id: 1) {
              id
              title
            }
          }
        `,
      },
    })
    equal(res.statusCode, 200, 'pages status code')
    deepEqual(res.json(), {
      data: {
        getPageById: {
          id: 1,
          title: 'Hello World',
        },
      },
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
        `,
      },
    })
    equal(res.statusCode, 200, 'savePage status code')
    deepEqual(res.json(), {
      data: {
        savePage: null,
      },
      errors: [
        {
          message: 'operation not allowed',
          locations: [
            {
              line: 3,
              column: 13,
            },
          ],
          path: [
            'savePage',
          ],
        },
      ],
    }, 'savePage response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: {
        'X-PLATFORMATIC-ADMIN-SECRET': adminSecret,
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
            { title: 'Page 3' },
          ],
        },
      },
    })
    equal(res.statusCode, 200, 'savePage status code')
    deepEqual(res.json(), {
      data: {
        insertPages: [
          { id: 2, title: 'Page 1' },
          { id: 3, title: 'Page 2' },
          { id: 4, title: 'Page 3' },
        ],
      },
    }, 'savePage response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: {
        'X-PLATFORMATIC-ADMIN-SECRET': adminSecret,
      },
      body: {
        query: `
          mutation {
            deletePages(where: { title: { eq: "Page 1" } }) {
              id
              title
            }
          }
        `,
      },
    })
    equal(res.statusCode, 200, 'deletePages status code')
    deepEqual(res.json(), {
      data: {
        deletePages: [{
          id: 2,
          title: 'Page 1',
        }],
      },
    }, 'deletePages response')
  }
})

test('admin with no rules', async () => {
  const app = fastify()
  const adminSecret = require('crypto').randomUUID()
  app.register(core, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      ok('onDatabaseLoad called')

      await clear(db, sql)
      await createBasicPages(db, sql)
    },
  })
  app.register(auth, {
    adminSecret,
  })
  test.after(() => {
    app.close()
  })

  await app.ready()

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: {
        'X-PLATFORMATIC-ADMIN-SECRET': adminSecret,
      },
      body: {
        query: `
          mutation {
            savePage(input: { title: "Hello" }) {
              id
              title
            }
          }
        `,
      },
    })
    equal(res.statusCode, 200, 'savePage status code')
    deepEqual(res.json(), {
      data: {
        savePage: {
          id: 1,
          title: 'Hello',
        },
      },
    }, 'savePage response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: {
        'X-PLATFORMATIC-ADMIN-SECRET': adminSecret,
      },
      body: {
        query: `
          query {
            getPageById(id: 1) {
              id
              title
            }
          }
        `,
      },
    })
    equal(res.statusCode, 200, 'getPageById status code')
    deepEqual(res.json(), {
      data: {
        getPageById: {
          id: 1,
          title: 'Hello',
        },
      },
    }, 'getPageById response')
  }
})

test('platformatic-admin has lower priority to allow user impersonation', async () => {
  const app = fastify()
  const adminSecret = require('crypto').randomUUID()
  app.register(core, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      ok('onDatabaseLoad called')

      await clear(db, sql)
      await createBasicPages(db, sql)
    },
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
        userId: 'X-PLATFORMATIC-USER-ID',
      },
      save: {
        checks: {
          userId: 'X-PLATFORMATIC-USER-ID',
        },
      },
    }, {
      role: 'anonymous',
      entity: 'page',
      find: false,
      delete: false,
      save: false,
    }],
  })
  test.after(() => {
    app.close()
  })

  await app.ready()

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: {
        'X-PLATFORMATIC-ADMIN-SECRET': adminSecret,
        'X-PLATFORMATIC-USER-ID': 42,
        'X-PLATFORMATIC-ROLE': ['user', 'platformatic-admin'],
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
        `,
      },
    })
    equal(res.statusCode, 200, 'savePage status code')
    deepEqual(res.json(), {
      data: {
        savePage: {
          id: 1,
          title: 'Hello',
          userId: 42,
        },
      },
    }, 'savePage response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: {
        'X-PLATFORMATIC-ADMIN-SECRET': adminSecret,
        'X-PLATFORMATIC-USER-ID': 42,
        'X-PLATFORMATIC-ROLE': ['user', 'platformatic-admin'],
      },
      body: {
        query: `
          mutation {
            deletePages(where: { title: { eq: "Hello" } }) {
              id
              title
            }
          }
        `,
      },
    })
    equal(res.statusCode, 200, 'deletePages status code')
    deepEqual(res.json(), {
      data: {
        deletePages: null,
      },
      errors: [
        {
          message: 'operation not allowed',
          locations: [
            {
              line: 3,
              column: 13,
            },
          ],
          path: [
            'deletePages',
          ],
        },
      ],
    }, 'deletePages response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: {
        'X-PLATFORMATIC-ADMIN-SECRET': adminSecret,
        'X-PLATFORMATIC-USER-ID': 42,
        'X-PLATFORMATIC-ROLE': ['platformatic-admin'],
      },
      body: {
        query: `
          mutation {
            deletePages(where: { title: { eq: "Hello" } }) {
              id
              title
            }
          }
        `,
      },
    })
    equal(res.statusCode, 200, 'deletePages status code')
    deepEqual(res.json(), {
      data: {
        deletePages: [{
          id: 1,
          title: 'Hello',
        }],
      },
    }, 'deletePages response')
  }
})

test('adminSecret set admin role as only role if jwt is set', async () => {
  const app = fastify()
  const adminSecret = require('crypto').randomUUID()
  app.register(core, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      ok('onDatabaseLoad called')

      await clear(db, sql)
      await createBasicPages(db, sql)
    },
  })
  app.register(auth, {
    jwt: {
      secret: 'supersecret',
    },
    adminSecret,
    roleKey: 'X-PLATFORMATIC-ROLE',
    anonymousRole: 'anonymous',
    rules: [{
      role: 'user',
      entity: 'page',
      find: false,
      delete: false,
      save: false,
    }, {
      role: 'anonymous',
      entity: 'page',
      find: false,
      delete: false,
      save: false,
    }],
  })
  test.after(() => {
    app.close()
  })

  await app.ready()

  const token = await app.jwt.sign({
    'X-PLATFORMATIC-USER-ID': 42,
    'X-PLATFORMATIC-ROLE': 'user',
  })

  {
    // This succeeds because the adminSecret is set and then the admin role is set as the only role
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: {
        'X-PLATFORMATIC-ADMIN-SECRET': adminSecret,
        Authorization: `Bearer ${token}`,
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
        `,
      },
    })
    equal(res.statusCode, 200, 'savePage status code')
    deepEqual(res.json(), {
      data: {
        savePage: {
          id: '1',
          title: 'Hello',
          userId: null,
        },
      },
    }, 'savePage response')
  }
})

test('adminSecret set admin as only role if webhook is set', async () => {
  async function buildAuthorizer (opts = {}) {
    // We need forceCloseConnection otherwise the test will hang with node16
    const app = fastify({ forceCloseConnections: true })
    app.register(require('@fastify/cookie'))
    app.register(require('@fastify/session'), {
      cookieName: 'sessionId',
      secret: 'a secret with minimum length of 32 characters',
      cookie: { secure: false },
    })

    app.post('/login', async (request, reply) => {
      request.session.user = request.body
      return {
        status: 'ok',
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
      ok('onDatabaseLoad called')

      await clear(db, sql)
      await createBasicPages(db, sql)
    },
  })

  const authorizer = await buildAuthorizer()
  app.register(auth, {
    webhook: {
      url: `http://localhost:${authorizer.server.address().port}/authorize`,
    },
    adminSecret,
    roleKey: 'X-PLATFORMATIC-ROLE',
    anonymousRole: 'anonymous',
    rules: [{
      role: 'user',
      entity: 'page',
      find: false,
      delete: false,
      save: false,
    }, {
      role: 'anonymous',
      entity: 'page',
      find: false,
      delete: false,
      save: false,
    }],
  })
  async function getCookie (userId, role) {
    const res = await request(`http://localhost:${authorizer.server.address().port}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        'X-PLATFORMATIC-USER-ID': userId,
        'X-PLATFORMATIC-ROLE': role,
      }),
    })

    res.body.resume()

    const cookie = res.headers['set-cookie'].split(';')[0]
    return cookie
  }
  test.after(() => {
    app.close()
  })
  test.after(() => authorizer.close())

  const cookie = await getCookie(42, 'user')
  await app.ready()
  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: {
        cookie,
        'X-PLATFORMATIC-ADMIN-SECRET': adminSecret,
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
        `,
      },
    })
    equal(res.statusCode, 200, 'savePage status code')
    deepEqual(res.json(), {
      data: {
        savePage: {
          id: '1',
          title: 'Hello',
          userId: null,
        },
      },
    }, 'savePage response')
  }
})
