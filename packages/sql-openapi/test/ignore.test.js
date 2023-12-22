'use strict'

const { clear, connInfo, isSQLite } = require('./helper')
const { test } = require('tap')
const fastify = require('fastify')
const sqlOpenAPI = require('..')
const sqlMapper = require('@platformatic/sql-mapper')

async function createBasicPages (db, sql) {
  if (isSQLite) {
    await db.query(sql`CREATE TABLE pages (
      id INTEGER PRIMARY KEY,
      title VARCHAR(42)
    );`)
    await db.query(sql`CREATE TABLE categories (
      id INTEGER PRIMARY KEY,
      name VARCHAR(42)
    );`)
  } else {
    await db.query(sql`CREATE TABLE pages (
      id SERIAL PRIMARY KEY,
      title VARCHAR(42)
    );`)
    await db.query(sql`CREATE TABLE categories (
      id SERIAL PRIMARY KEY,
      name VARCHAR(42)
    );`)
  }
}

test('ignore a table', async ({ pass, teardown, equal }) => {
  const app = fastify()
  app.register(sqlMapper, {
    ...connInfo,
    ignore: {
      categories: true
    },
    async onDatabaseLoad (db, sql) {
      pass('onDatabaseLoad called')

      await clear(db, sql)
      await createBasicPages(db, sql)
    }
  })
  app.register(sqlOpenAPI)
  teardown(app.close.bind(app))

  await app.ready()

  {
    const res = await app.inject({
      method: 'GET',
      url: '/documentation/json'
    })
    equal(res.statusCode, 200, 'GET /documentation/json status code')
    const data = res.json()
    equal(data.paths['categories/'], undefined, 'category/ paths are ignored')
  }
})

test('ignore a column', async ({ pass, teardown, equal }) => {
  const app = fastify()
  app.register(sqlMapper, {
    ...connInfo,
    ignore: {
      categories: {
        name: true
      }
    },
    async onDatabaseLoad (db, sql) {
      pass('onDatabaseLoad called')

      await clear(db, sql)
      await createBasicPages(db, sql)
    }
  })
  app.register(sqlOpenAPI)
  teardown(app.close.bind(app))

  await app.ready()

  {
    const res = await app.inject({
      method: 'GET',
      url: '/documentation/json'
    })
    equal(res.statusCode, 200, 'GET /documentation/json status code')
    const data = res.json()
    equal(data.components.schemas.Category.properties.name, undefined, 'name property is ignored')
  }
})

test('ignore a table from OpenAPI', async ({ pass, teardown, equal }) => {
  const app = fastify()
  app.register(sqlMapper, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      pass('onDatabaseLoad called')

      await clear(db, sql)
      await createBasicPages(db, sql)
    }
  })
  app.register(sqlOpenAPI, {
    ignore: {
      category: true
    }
  })
  teardown(app.close.bind(app))

  await app.ready()

  {
    const res = await app.inject({
      method: 'GET',
      url: '/documentation/json'
    })
    equal(res.statusCode, 200, 'GET /documentation/json status code')
    const data = res.json()
    equal(data.paths['categories/'], undefined, 'category/ paths are ignored')
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: '/categories'
    })
    equal(res.statusCode, 404, 'GET /categories status code')
  }

  equal(Boolean(app.platformatic.entities.category), true, 'category entity exists')
})

test('show a warning if there is no ignored entity', async ({ plan, pass, teardown }) => {
  plan(2)

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
        if (msg === 'Ignored openapi entity "missingEntityPages" not found. Did you mean "page"?') {
          pass('warning message is shown')
        }
      }
    }
  })

  app.register(sqlMapper, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      pass('onDatabaseLoad called')

      await clear(db, sql)
      await createBasicPages(db, sql)
    }
  })
  app.register(sqlOpenAPI, {
    ignore: {
      missingEntityPages: true
    }
  })
  teardown(app.close.bind(app))

  await app.ready()
})

test('show a warning if database is empty', async ({ plan, pass, teardown }) => {
  plan(2)

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
        if (msg === 'Ignored openapi entity "missingEntityPages" not found.') {
          pass('warning message is shown')
        }
      }
    }
  })

  app.register(sqlMapper, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      pass('onDatabaseLoad called')

      await clear(db, sql)
    }
  })
  app.register(sqlOpenAPI, {
    ignore: {
      missingEntityPages: true
    }
  })
  teardown(app.close.bind(app))

  await app.ready()
})

test('ignore a column in OpenAPI', async ({ pass, teardown, equal, same }) => {
  const app = fastify()
  app.register(sqlMapper, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      pass('onDatabaseLoad called')

      await clear(db, sql)
      await createBasicPages(db, sql)
    }
  })
  app.register(sqlOpenAPI, {
    ignore: {
      category: {
        name: true
      }
    }
  })
  teardown(app.close.bind(app))

  await app.ready()

  const res = await app.inject({
    method: 'GET',
    url: '/documentation/json'
  })
  equal(res.statusCode, 200, 'GET /documentation/json status code')
  const data = res.json()
  equal(data.components.schemas.Category.properties.name, undefined, 'name property is ignored')

  const parameters = data.paths['/categories/'].get.parameters
  const hasNameInWhere = parameters.some((parameter) => {
    return /.*name.*/.test(parameter.name)
  })
  equal(hasNameInWhere, false)

  const fieldsParameter = parameters.find((parameter) => {
    return parameter.name === 'fields' && parameter.in === 'query'
  })

  same(fieldsParameter.schema.items.enum, ['id'])
})

test('show a warning if there is no ignored entity field', async ({ plan, pass, teardown }) => {
  plan(2)

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
        if (msg === 'Ignored openapi field "missingFieldName" not found in entity "category". Did you mean "name"?') {
          pass('warning message is shown')
        }
      }
    }
  })

  app.register(sqlMapper, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      pass('onDatabaseLoad called')

      await clear(db, sql)
      await createBasicPages(db, sql)
    }
  })
  app.register(sqlOpenAPI, {
    ignore: {
      category: {
        missingFieldName: true
      }
    }
  })
  teardown(app.close.bind(app))

  await app.ready()
})
