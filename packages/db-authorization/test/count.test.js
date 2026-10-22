import core from '@platformatic/db-core'
import fastify from 'fastify'
import { deepEqual, equal, ok } from 'node:assert'
import { test } from 'node:test'
import auth from '../index.js'
import { clear, connInfo, createBasicPages } from './helper.js'

async function buildApp () {
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
    rules: [
      {
        role: 'user',
        entity: 'page',
        find: {
          checks: {
            userId: 'X-PLATFORMATIC-USER-ID'
          }
        },
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

  await app.ready()
  return app
}

async function savePage (app, token, title) {
  const res = await app.inject({
    method: 'POST',
    url: '/graphql',
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: {
      query: `
        mutation {
          savePage(input: { title: "${title}" }) {
            id
          }
        }
      `
    }
  })
  equal(res.statusCode, 200, 'savePage status code')
  equal(res.json().errors, undefined, 'savePage has no errors')
}

test('count applies the find rule of the user', async () => {
  const app = await buildApp()
  test.after(() => {
    app.close()
  })

  const tokenA = await app.jwt.sign({
    'X-PLATFORMATIC-USER-ID': 42,
    'X-PLATFORMATIC-ROLE': 'user'
  })
  const tokenB = await app.jwt.sign({
    'X-PLATFORMATIC-USER-ID': 43,
    'X-PLATFORMATIC-ROLE': 'user'
  })

  await savePage(app, tokenA, 'A1')
  await savePage(app, tokenA, 'A2')
  await savePage(app, tokenB, 'B1')

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: {
        Authorization: `Bearer ${tokenA}`
      },
      body: {
        query: `
          query {
            countPages {
              total
            }
          }
        `
      }
    })
    equal(res.statusCode, 200, 'countPages status code')
    deepEqual(res.json(), {
      data: {
        countPages: {
          total: 2
        }
      }
    }, 'countPages counts only the pages of user 42')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: {
        Authorization: `Bearer ${tokenB}`
      },
      body: {
        query: `
          query {
            countPages(where: { title: { like: "%1" } }) {
              total
            }
          }
        `
      }
    })
    equal(res.statusCode, 200, 'countPages status code')
    deepEqual(res.json(), {
      data: {
        countPages: {
          total: 1
        }
      }
    }, 'countPages combines the user where with the rule')
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: '/pages?totalCount=true&limit=1',
      headers: {
        Authorization: `Bearer ${tokenA}`
      }
    })
    equal(res.statusCode, 200, 'GET /pages status code')
    equal(res.headers['x-total-count'], '2', 'X-Total-Count counts only the pages of user 42')
  }
})

test('count is unauthorized when the role cannot find', async () => {
  const app = await buildApp()
  test.after(() => {
    app.close()
  })

  const token = await app.jwt.sign({
    'X-PLATFORMATIC-USER-ID': 42,
    'X-PLATFORMATIC-ROLE': 'user'
  })
  await savePage(app, token, 'Hello')

  const res = await app.inject({
    method: 'POST',
    url: '/graphql',
    body: {
      query: `
        query {
          countPages {
            total
          }
        }
      `
    }
  })
  equal(res.statusCode, 200, 'countPages status code')
  deepEqual(res.json(), {
    data: {
      countPages: null
    },
    errors: [
      {
        message: 'operation not allowed',
        locations: [
          {
            line: 3,
            column: 11
          }
        ],
        path: ['countPages']
      }
    ]
  }, 'anonymous cannot count pages')
})

test('count from code skips authorization without a ctx or with skipAuth', async () => {
  const app = await buildApp()
  test.after(() => {
    app.close()
  })

  const token = await app.jwt.sign({
    'X-PLATFORMATIC-USER-ID': 42,
    'X-PLATFORMATIC-ROLE': 'user'
  })
  await savePage(app, token, 'Hello')

  equal(await app.platformatic.entities.page.count(), 1, 'count without ctx')
  equal(await app.platformatic.entities.page.count({ skipAuth: true }), 1, 'count with skipAuth')
})
