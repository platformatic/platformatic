'use strict'

const { test } = require('tap')
const fastify = require('fastify')
const core = require('@platformatic/db-core')
const { connInfo, clear, isSQLite } = require('./helper')
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

test('users can save and update their own pages, read everybody\'s and delete none', async ({ pass, teardown, same, equal }) => {
  const app = fastify()
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

  const token = await app.jwt.sign({
    'X-PLATFORMATIC-USER-ID': 42,
    'X-PLATFORMATIC-ROLE': 'user'
  })

  {
    const res = await app.inject({
      method: 'POST',
      url: '/pages',
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: {
        title: 'Hello'
      }
    })
    equal(res.statusCode, 200, 'POST /pages status code')
    same(res.json(), {
      id: 1,
      title: 'Hello',
      userId: 42
    }, 'POST /pages response')
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: '/pages/1',
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
    equal(res.statusCode, 200, 'GET /pages/1 status code')
    same(res.json(), {
      id: 1,
      title: 'Hello',
      userId: 42
    }, 'GET /pages/1 response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/pages/1?fields=id,title',
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: {
        title: 'Hello World'
      }
    })
    equal(res.statusCode, 200, 'POST /pages/1 status code')
    same(res.json(), {
      id: 1,
      title: 'Hello World'
    }, 'POST /pages/1 response')
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: '/pages/1?fields=id,title',
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
    equal(res.statusCode, 200, 'GET /pages/1 status code')
    same(res.json(), {
      id: 1,
      title: 'Hello World'
    }, 'GET /pages/1 response')
  }

  const token2 = await app.jwt.sign({
    'X-PLATFORMATIC-USER-ID': 43,
    'X-PLATFORMATIC-ROLE': 'user'
  })

  {
    const res = await app.inject({
      method: 'POST',
      url: '/pages/1',
      headers: {
        Authorization: `Bearer ${token2}`
      },
      body: {
        title: 'Hello World2'
      }
    })
    equal(res.statusCode, 401, 'POST /pages/1 status code (Unauthorized)')
    same(res.json(), {
      message: 'operation not allowed',
      code: 'PLT_DB_AUTH_UNAUTHORIZED',
      error: 'Unauthorized',
      statusCode: 401
    }, 'POST /pages/1 response (Unauthorized)')
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: '/pages/1',
      headers: {
        Authorization: `Bearer ${token2}`
      }
    })
    equal(res.statusCode, 200, 'GET /pages/1 status code (Authorized)')
    same(res.json(), {
      id: 1,
      title: 'Hello World',
      userId: 42
    }, 'GET /pages/1 response (Authorized)')
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: '/pages/1'
    })
    equal(res.statusCode, 401, 'GET /pages/1 status code (Anonymous)')
    same(res.json(), {
      message: 'operation not allowed',
      code: 'PLT_DB_AUTH_UNAUTHORIZED',
      error: 'Unauthorized',
      statusCode: 401
    }, 'GET /pages/1 response (Anonymous)')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/pages/1',
      body: {
        title: 'Hello World3'
      }
    })
    equal(res.statusCode, 401, 'POST /pages/1 status code (Anonymous)')
    same(res.json(), {
      message: 'operation not allowed',
      code: 'PLT_DB_AUTH_UNAUTHORIZED',
      error: 'Unauthorized',
      statusCode: 401
    }, 'POST /pages/1 response (Anonymous)')
  }

  {
    const res = await app.inject({
      method: 'DELETE',
      url: '/pages/1',
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
    equal(res.statusCode, 401, 'DELETE /pages/1 status code (Unauthorized)')
    same(res.json(), {
      message: 'operation not allowed',
      code: 'PLT_DB_AUTH_UNAUTHORIZED',
      error: 'Unauthorized',
      statusCode: 401
    }, 'DELETE /pages/1 response (Unauthorized)')
  }
})

test('users can find pages with parameters specified', async ({ pass, teardown, same, equal }) => {
  const app = fastify()
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
    roleKey: 'X-PLATFORMATIC-ROLE',
    anonymousRole: 'anonymous',
    rules: [{
      role: 'user',
      entity: 'page',
      save: true,
      find: true,
      delete: false,
      defaults: {
        userId: 'X-PLATFORMATIC-USER-ID'
      }
    }]
  })
  teardown(app.close.bind(app))

  await app.ready()

  const token = await app.jwt.sign({
    'X-PLATFORMATIC-USER-ID': 42,
    'X-PLATFORMATIC-ROLE': 'user'
  })

  const pages = [
    {
      title: 'title 1'
    },
    {
      title: 'title 2'
    },
    {
      title: 'title 3'
    },
    {
      title: 'title 4'
    },
    {
      title: 'title 5'
    }
  ]
  for (const page of pages) {
    await app.inject({
      method: 'POST',
      url: '/pages',
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: page
    })
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: '/pages?limit=2&offset=2',
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
    equal(res.statusCode, 200, '/pages?limit=2&offset=2 status code')
    same(res.json(), pages.map((p, i) => {
      return { ...p, id: i + 1, userId: 42 }
    }).slice(2, 4), '/pages?limit=2&offset=2 response')
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: '/pages?orderby.id=desc',
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
    equal(res.statusCode, 200, '/pages?orderby.id=desc status code')
    same(res.json(), pages.map((p, i) => {
      return { ...p, id: i + 1, userId: 42 }
    }).reverse(), '/pages?orderby.id=desc response')
  }
})

test('users can find and updateMany pages', async ({ pass, teardown, same, equal }) => {
  const app = fastify()
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
    roleKey: 'X-PLATFORMATIC-ROLE',
    anonymousRole: 'anonymous',
    rules: [{
      role: 'user',
      entity: 'page',
      save: true,
      find: true,
      updateMany: true,
      defaults: {
        userId: 'X-PLATFORMATIC-USER-ID'
      }
    }]
  })
  teardown(app.close.bind(app))

  await app.ready()

  const token = await app.jwt.sign({
    'X-PLATFORMATIC-USER-ID': 42,
    'X-PLATFORMATIC-ROLE': 'user'
  })

  const pages = [
    {
      title: 'title 1'
    },
    {
      title: 'title 2'
    },
    {
      title: 'title 3'
    },
    {
      title: 'title 4'
    },
    {
      title: 'title 5'
    }
  ]
  for (const page of pages) {
    await app.inject({
      method: 'POST',
      url: '/pages',
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: page
    })
  }

  {
    const res = await app.inject({
      method: 'PUT',
      url: '/pages?where.id.in=1,2',
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: {
        title: 'Updated title'
      }
    })
    equal(res.statusCode, 200, '/pages?where.id.in=1,2 status code')
    same(res.json(), [
      {
        id: 1,
        title: 'Updated title',
        userId: 42
      },
      {
        id: 2,
        title: 'Updated title',
        userId: 42
      }
    ], '/pages?where.id.in=1,2 response')
  }
})
