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

test('additional options are passed to original functions', async ({ plan, teardown, equal }) => {
  plan(5)
  const app = fastify()
  app.register(core, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      await clear(db, sql)
      await createBasicPages(db, sql)
    }
  })
  app.register(auth, {
    jwt: { secret: 'supersecret' },
    roleKey: 'X-PLATFORMATIC-ROLE',
    anonymousRole: 'anonymous',
    rules: [{
      role: 'user',
      entity: 'page',
      save: true,
      find: true,
      updateMany: true,
      delete: true,
      insert: true,
      defaults: {
        userId: 'X-PLATFORMATIC-USER-ID'
      }
    }]
  })

  // add hooks to intercept options passed from entity action to db-auth
  app.register(async function (fastify, opts) {
    fastify.platformatic.addEntityHooks('page', {
      find: (originalFind, opts) => {
        equal(opts.cool, 'find')
        return originalFind(opts)
      },
      save: (originalSave, opts) => {
        equal(opts.cool, 'save')
        return originalSave(opts)
      },
      delete: (originalDelete, opts) => {
        equal(opts.cool, 'delete')
        return originalDelete(opts)
      },
      insert: (originalInsert, opts) => {
        equal(opts.cool, 'insert')
        return originalInsert(opts)
      },
      updateMany: (originalUpdateMany, opts) => {
        equal(opts.cool, 'updateMany')
        return originalUpdateMany(opts)
      }
    })

    fastify.post('/rest-save', async (req, reply) => {
      await fastify.platformatic.entities.page.save({
        fields: ['id'],
        input: { title: 'title 1' },
        cool: 'save'
      })
    })

    fastify.post('/rest-insert', async (req, reply) => {
      await fastify.platformatic.entities.page.insert({
        fields: ['id'],
        inputs: [
          { title: 'title 2' },
          { title: 'title 3' }
        ],
        cool: 'insert'
      })
    })

    fastify.post('/rest-update', async (req, reply) => {
      await fastify.platformatic.entities.page.updateMany({
        fields: ['id'],
        input: { title: 'title 2 - updated' },
        where: {
          title: { eq: 'title 2' }
        },
        cool: 'updateMany'
      })
    })

    fastify.post('/rest-delete', async (req, reply) => {
      await fastify.platformatic.entities.page.delete({
        fields: ['id'],
        where: {
          title: { eq: 'title 3' }
        },
        cool: 'delete'
      })
    })

    fastify.post('/rest-find', async (req, reply) => {
      await fastify.platformatic.entities.page.find({
        fields: ['id'],
        cool: 'find'
      })
    })
  })
  teardown(app.close.bind(app))

  await app.ready()

  const token = await app.jwt.sign({
    'X-PLATFORMATIC-USER-ID': 42,
    'X-PLATFORMATIC-ROLE': 'user'
  })

  const entityFns = ['save', 'insert', 'delete', 'update', 'find'].map(action => {
    return app.inject({
      method: 'POST',
      url: `/rest-${action}`,
      headers: {
        authorization: `Bearer ${token}`
      },
      body: {}
    })
  })

  await Promise.all(entityFns)
})
