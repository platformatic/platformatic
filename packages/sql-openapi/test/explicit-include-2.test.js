'use strict'

const { clear, connInfo, createBasicPages } = require('./helper')
const { tspl } = require('@matteo.collina/tspl')
const { test } = require('node:test')
const fastify = require('fastify')
const sqlOpenAPI = require('..')
const sqlMapper = require('@platformatic/sql-mapper')

test('include entity and partially ignore an entity with OpenAPI', async (t) => {
  const { ok, equal } = tspl(t, { plan: 4 })
  const app = fastify()
  app.register(sqlMapper, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      ok('onDatabaseLoad called')

      await clear(db, sql)
      await createBasicPages(db, sql)
    }
  })
  app.register(sqlOpenAPI, {
    include: {
      category: true
    },
    ignore: {
      category: {
        name: true
      }
    }
  })
  t.after(() => app.close())

  await app.ready()

  const res = await app.inject({
    method: 'GET',
    url: '/documentation/json'
  })
  equal(res.statusCode, 200, 'GET /documentation/json status code')
  const data = res.json()
  equal(data.components.schemas.Pages, undefined, 'Pages schema is ignored')
  equal(data.components.schemas.Category.properties.name, undefined, 'name property is ignored')
})

test('show a warning if included entity is not found', async (t) => {
  const { ok } = tspl(t, { plan: 1 })
  const app = fastify({
    logger: {
      info () {},
      debug () {},
      trace () {},
      fatal () {},
      error () {},
      child () {
        return this
      },
      warn (msg) {
        if (msg === 'Included openapi entity "missingEntityPages" not found. Did you mean "page"?') {
          ok('warning message is shown')
        }
      }
    }
  })

  app.register(sqlMapper, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      ok('onDatabaseLoad called')

      await clear(db, sql)
      await createBasicPages(db, sql)
    }
  })
  app.register(sqlOpenAPI, {
    include: {
      missingEntityPages: true
    }
  })
  t.after(() => app.close())

  await app.ready()
})

test('show a warning if database is empty', async (t) => {
  const { ok } = tspl(t, { plan: 1 })
  const app = fastify({
    logger: {
      info () {},
      debug () {},
      trace () {},
      fatal () {},
      error () {},
      child () {
        return this
      },
      warn (msg) {
        if (msg === 'Included openapi entity "missingEntityPages" not found.') {
          ok('warning message is shown')
        }
      }
    }
  })

  app.register(sqlMapper, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      ok('onDatabaseLoad called')

      await clear(db, sql)
    }
  })
  app.register(sqlOpenAPI, {
    include: {
      missingEntityPages: true
    }
  })
  t.after(() => app.close())

  await app.ready()
})

test('entity responds to traffic an entity in OpenAPI', async (t) => {
  const { ok, equal, deepEqual: same } = tspl(t, { plan: 6 })
  const app = fastify()
  app.register(sqlMapper, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      ok('onDatabaseLoad called')

      await clear(db, sql)
      await createBasicPages(db, sql)
    }
  })
  app.register(sqlOpenAPI, {
    include: {
      category: true
    },
    ignore: {
      category: {
        name: true
      }
    }
  })
  t.after(() => app.close())

  await app.ready()

  {
    const res = await app.inject({
      method: 'POST',
      url: '/categories',
      body: {
        id: 123
      }
    })
    equal(res.statusCode, 200, 'POST /categories status code')
    equal(res.headers.location, '/categories/123', 'POST /api/categories location')
    same(res.json(), {
      id: 123
    }, 'POST /categories response')
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: '/categories/1'
    })
    equal(res.statusCode, 404, 'GET /categories/1 status code')
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: '/categories/123'
    })
    same(res.json(), { id: 123 })
  }
})
