import core from '@platformatic/db-core'
import fastify from 'fastify'
import { deepEqual, equal, ok } from 'node:assert'
import { test } from 'node:test'
import auth from '../index.js'
import { clear, connInfo, createBasicPages } from './helper.js'

test('roles defined in objects and extracted with rolePath', async () => {
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
    rolePath: 'resource_access.account.roles',
    anonymousRole: 'anonymous',
    rules: [
      {
        role: 'moderator',
        entity: 'page',
        find: true,
        delete: true,
        save: true,
        defaults: {
          userId: 'X-PLATFORMATIC-USER-ID'
        }
      },
      {
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
      },
      {
        role: 'anonymous',
        entity: 'page',
        find: false,
        delete: false,
        save: false
      }
    ]
  })
  test.after(() => {
    app.close()
  })

  await app.ready()

  // Token with user and moderator roles as array
  const token = await app.jwt.sign({
    'X-PLATFORMATIC-USER-ID': 42,
    resource_access: {
      account: {
        roles: ['user', 'moderator']
      }
    }
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
    deepEqual(
      res.json(),
      {
        data: {
          savePage: {
            id: 1,
            title: 'Hello',
            userId: 42
          }
        }
      },
      'savePage response'
    )
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
    deepEqual(
      res.json(),
      {
        data: {
          deletePages: [
            {
              id: 1,
              title: 'Hello'
            }
          ]
        }
      },
      'deletePages response'
    )
  }

  // Token with user and moderator roles as comma separated string
  const token2 = await app.jwt.sign({
    'X-PLATFORMATIC-USER-ID': 42,
    resource_access: {
      account: {
        roles: 'moderator, user'
      }
    }
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
    deepEqual(
      res.json(),
      {
        data: {
          savePage: {
            id: 2,
            title: 'Hello',
            userId: 42
          }
        }
      },
      'savePage response'
    )
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
    deepEqual(
      res.json(),
      {
        data: {
          deletePages: [
            {
              id: 2,
              title: 'Hello'
            }
          ]
        }
      },
      'deletePages response'
    )
  }

  const token3 = await app.jwt.sign({
    'X-PLATFORMATIC-USER-ID': 43,
    resource_access: {
      account: {
        roles: 'user'
      }
    }
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
    deepEqual(
      res.json(),
      {
        data: {
          savePage: {
            id: 3,
            title: 'Hello',
            userId: 43
          }
        }
      },
      'savePage response'
    )
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
    deepEqual(
      res.json(),
      {
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
            path: ['deletePages']
          }
        ]
      },
      'deletePages response'
    )
  }
})
