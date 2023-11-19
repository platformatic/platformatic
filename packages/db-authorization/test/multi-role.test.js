'use strict'

const { test } = require('node:test')
const { equal, deepEqual, ok } = require('node:assert')
const fastify = require('fastify')
const core = require('@platformatic/db-core')
const { connInfo, clear, createBasicPages } = require('./helper')
const auth = require('..')

test('moderators can delete user pages', async () => {
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
    jwt: {
      secret: 'supersecret'
    },
    roleKey: 'X-PLATFORMATIC-ROLE',
    anonymousRole: 'anonymous',
    rules: [{
      role: 'moderator',
      entity: 'page',
      find: true,
      delete: true,
      save: true,
      defaults: {
        userId: 'X-PLATFORMATIC-USER-ID'
      }
    }, {
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

  await app.ready()

  const token = await app.jwt.sign({
    'X-PLATFORMATIC-USER-ID': 42,
    'X-PLATFORMATIC-ROLE': 'user,moderator'
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
    deepEqual(res.json(), {
      data: {
        deletePages: [{
          id: 1,
          title: 'Hello'
        }]
      }
    }, 'deletePages response')
  }

  const token2 = await app.jwt.sign({
    'X-PLATFORMATIC-USER-ID': 42,
    'X-PLATFORMATIC-ROLE': 'moderator,user'
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
          id: 2,
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
        Authorization: `Bearer ${token2}`
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
    deepEqual(res.json(), {
      data: {
        deletePages: [{
          id: 2,
          title: 'Hello'
        }]
      }
    }, 'deletePages response')
  }

  const token3 = await app.jwt.sign({
    'X-PLATFORMATIC-USER-ID': 43,
    'X-PLATFORMATIC-ROLE': 'user'
  })

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: {
        Authorization: `Bearer ${token3}`
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
          id: 3,
          title: 'Hello',
          userId: 43
        }
      }
    }, 'savePage response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: {
        Authorization: `Bearer ${token3}`
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
})

test('blocked users cannot update', async () => {
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
    jwt: {
      secret: 'supersecret'
    },
    roleKey: 'X-PLATFORMATIC-ROLE',
    anonymousRole: 'anonymous',
    rules: [{
      role: 'blocked',
      entity: 'page',
      find: true,
      delete: false,
      save: false
    }, {
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

  const token2 = await app.jwt.sign({
    'X-PLATFORMATIC-USER-ID': 42,
    'X-PLATFORMATIC-ROLE': 'blocked,user'
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
          query {
            pages(where: { title: { eq: "Hello" } }) {
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
        pages: [{
          id: 1,
          title: 'Hello',
          userId: 42
        }]
      }
    }, 'pages response')
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
            deletePages(where: { title: { eq: "Hello" } }) {
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
