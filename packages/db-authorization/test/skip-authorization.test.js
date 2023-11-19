'use strict'

const { test } = require('node:test')
const { equal, deepEqual, ok, rejects } = require('node:assert')
const fastify = require('fastify')
const core = require('@platformatic/db-core')
const { connInfo, clear, createBasicPages } = require('./helper')
const auth = require('..')

test('use the skipAuth option to avoid permissions programatically', async () => {
  const app = fastify()
  app.register(core, {
    ...connInfo,
    events: false,
    async onDatabaseLoad (db, sql) {
      ok('onDatabaseLoad called')

      await clear(db, sql)
      await createBasicPages(db, sql)
    }
  })
  app.register(auth, {
    jwt: {
      secret: 'supersecret'
    },
    roleKey: 'X-PLATFORMATIC-ROLE',
    anonymousRole: 'anonymous',
    rules: [{
      role: 'user',
      entity: 'page',
      find: false,
      delete: false,
      save: false
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

  await app.ready()

  const token = await app.jwt.sign({
    'X-PLATFORMATIC-USER-ID': 42,
    'X-PLATFORMATIC-ROLE': 'user'
  })

  // create a page through the API fails...
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

  // ...but it works if we skip the authorization programmatically
  {
    const res = await app.platformatic.entities.page.save({
      input: { title: 'page title' },
      ctx: {
        reply: () => {}
      },
      skipAuth: true
    })
    deepEqual(res, { id: '1', title: 'page title', userId: null }, 'save')
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

    deepEqual(res.json(), {
      data: {
        getPageById: null
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
            'getPageById'
          ]
        }
      ]
    }, 'getPageById')
  }

  // ...but it works if we skip the authorization programmatically
  {
    const res = await app.platformatic.entities.page.find({
      ctx: {
        reply: () => {}
      },
      skipAuth: true
    })
    deepEqual(res, [{ id: '1', title: 'page title', userId: null }], 'find')
  }

  {
    const resInsert = await app.platformatic.entities.page.insert({
      inputs: [{ title: 'page title2' }],
      skipAuth: true
    })

    deepEqual(resInsert, [{ id: '2', title: 'page title2', userId: null }], 'insert')
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
            deletePages(where: { id: { eq: 1 } }) {
              id
              title
            }
          }
        `
      }
    })
    equal(res.statusCode, 200, 'deletePages status code')
    deepEqual(res.json(), {
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

  // update many pages through the API fails...
  {
    const res = await app.inject({
      method: 'GET',
      url: '/pages?where.id.gte=1',
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: {
        title: 'Updated page title'
      }
    })
    equal(res.statusCode, 401, 'updateMay status code')

    deepEqual(res.json(), {
      statusCode: 401,
      code: 'PLT_DB_AUTH_UNAUTHORIZED',
      error: 'Unauthorized',
      message: 'operation not allowed'
    }, 'updateMany response')
  }

  // ...but it works if we skip the authorization programmatically
  {
    const res = await app.platformatic.entities.page.updateMany({
      where: {
        id: {
          gte: 1
        }
      },
      input: { title: 'Updated page title' },
      ctx: {
        reply: () => {}
      },
      skipAuth: true
    })
    deepEqual(res, [
      { id: '1', title: 'Updated page title', userId: null },
      { id: '2', title: 'Updated page title', userId: null }
    ], 'updateMany')
  }

  {
    await app.platformatic.entities.page.delete({
      where: {
        id: {
          eq: 1
        }
      },
      skipAuth: true,
      ctx: {
        reply: () => {}
      }
    })

    await app.platformatic.entities.page.delete({
      where: {
        id: {
          eq: 2
        }
      },
      skipAuth: true,
      ctx: {
        reply: () => {}
      }
    })

    const res = await app.platformatic.entities.page.find({
      skipAuth: true,
      ctx: {
        reply: () => {}
      }
    })
    deepEqual(res, [], 'find')
  }
})

test('if ctx is not present, skips permission check ', async () => {
  const app = fastify()
  app.register(core, {
    ...connInfo,
    events: true,
    async onDatabaseLoad (db, sql) {
      ok('onDatabaseLoad called')

      await clear(db, sql)
      await createBasicPages(db, sql)
    }
  })
  app.register(auth, {
    jwt: {
      secret: 'supersecret'
    },
    roleKey: 'X-PLATFORMATIC-ROLE',
    anonymousRole: 'anonymous',
    rules: [{
      role: 'user',
      entity: 'page',
      find: false,
      delete: false,
      save: false
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

  await app.ready()

  const token = await app.jwt.sign({
    'X-PLATFORMATIC-USER-ID': 42,
    'X-PLATFORMATIC-ROLE': 'user'
  })

  // create a page through the API fails...
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

  // ...but it works if we don't have the context
  {
    const res = await app.platformatic.entities.page.save({
      input: { title: 'page title' }
    })
    deepEqual(res, { id: '1', title: 'page title', userId: null }, 'save')
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

    deepEqual(res.json(), {
      data: {
        getPageById: null
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
            'getPageById'
          ]
        }
      ]
    }, 'getPageById')
  }

  {
    const res = await app.platformatic.entities.page.find()
    deepEqual(res, [{ id: '1', title: 'page title', userId: null }], 'find')
  }

  {
    const resInsert = await app.platformatic.entities.page.insert({ inputs: [{ title: 'page title2' }] })

    deepEqual(resInsert, [{ id: '2', title: 'page title2', userId: null }], 'insert')
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
            deletePages(where: { id: { eq: 1 } }) {
              id
              title
            }
          }
        `
      }
    })
    equal(res.statusCode, 200, 'deletePages status code')
    deepEqual(res.json(), {
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

  // update many pages through the API fails...
  {
    const res = await app.inject({
      method: 'GET',
      url: '/pages?where.id.gte=1',
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: {
        title: 'Updated page title'
      }
    })
    equal(res.statusCode, 401, 'updateMay status code')

    deepEqual(res.json(), {
      statusCode: 401,
      code: 'PLT_DB_AUTH_UNAUTHORIZED',
      error: 'Unauthorized',
      message: 'operation not allowed'
    }, 'updateMany response')
  }

  {
    const res = await app.platformatic.entities.page.updateMany({
      where: {
        id: {
          gte: 1
        }
      },
      input: { title: 'Updated page title' }
    })
    deepEqual(res, [
      { id: '1', title: 'Updated page title', userId: null },
      { id: '2', title: 'Updated page title', userId: null }
    ], 'updateMany')
  }

  {
    await app.platformatic.entities.page.delete({
      where: {
        id: {
          eq: 1
        }
      }
    })

    await app.platformatic.entities.page.delete({
      where: {
        id: {
          eq: 2
        }
      }
    })

    const res = await app.platformatic.entities.page.find()
    deepEqual(res, [], 'find')
  }
})

test('validate that a ctx is needed for skipAuth: false', async () => {
  const app = fastify()
  app.register(core, {
    ...connInfo,
    events: false,
    async onDatabaseLoad (db, sql) {
      ok('onDatabaseLoad called')

      await clear(db, sql)
      await createBasicPages(db, sql)
    }
  })
  app.register(auth, {
    jwt: {
      secret: 'supersecret'
    },
    roleKey: 'X-PLATFORMATIC-ROLE',
    anonymousRole: 'anonymous',
    rules: [{
      role: 'user',
      entity: 'page',
      find: false,
      delete: false,
      save: false
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

  await app.ready()

  await rejects(app.platformatic.entities.page.delete({
    where: {
      id: {
        eq: 1
      }
    },
    skipAuth: false
  }))

  await rejects(app.platformatic.entities.page.save({
    input: { title: 'page title' },
    skipAuth: false
  }))

  await rejects(app.platformatic.entities.page.insert({
    inputs: [{ title: 'page title' }],
    skipAuth: false
  }))

  await rejects(app.platformatic.entities.page.find({
    skipAuth: false
  }))

  await rejects(app.platformatic.entities.page.updateMany({
    input: { title: 'page title' },
    skipAuth: false
  }))
})
