'use strict'

const { test } = require('node:test')
const { equal, deepEqual, ok } = require('node:assert')
const core = require('@platformatic/db-core')
const fastify = require('fastify')
const { connInfo, clear, createBasicPages } = require('./helper')
const auth = require('..')

test('users can save and update their own pages, read everybody\'s and delete none', async () => {
  const app = fastify()
  app.register(core, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      ok('onDatabaseLoad called')

      await clear(db, sql)
      await createBasicPages(db, sql)
    }
  })
  await app.register(auth, {
    jwt: {
      secret: 'supersecret'
    },
    roleKey: 'X-PLATFORMATIC-ROLE',
    anonymousRole: 'anonymous'
  })
  app.platformatic.addRulesForRoles([{
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
  }])
  test.after(async () => {
    await app.close()
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
    deepEqual(res.json(), {
      data: {
        getPageById: {
          id: 1,
          title: 'Hello World',
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
    deepEqual(res.json(), {
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
    }, 'getPageById response')
  }

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
    equal(res.statusCode, 200, 'insertPages status code')
    deepEqual(res.json(), {
      data: {
        insertPages: null
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
            'insertPages'
          ]
        }
      ]
    }, 'insertPages response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
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
