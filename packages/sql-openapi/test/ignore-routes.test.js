'use strict'

const { test } = require('tap')
const fastify = require('fastify')
const sqlOpenAPI = require('..')
const sqlMapper = require('@platformatic/sql-mapper')
const { clear, connInfo, isSQLite, isMysql, isMariaDB } = require('./helper')

async function createBasicPages (db, sql) {
  if (isSQLite) {
    await db.query(sql`CREATE TABLE categories (
      id INTEGER PRIMARY KEY,
      name VARCHAR(42)
    );`)
    await db.query(sql`CREATE TABLE pages (
      id INTEGER PRIMARY KEY,
      title VARCHAR(42),
      category_id INTEGER,
      CONSTRAINT category_fk FOREIGN KEY (category_id) REFERENCES categories (id)
    );`)
    await db.query(sql`CREATE TABLE tags (
      id INTEGER PRIMARY KEY,
      name VARCHAR(42)
    );`)
    await db.query(sql`CREATE TABLE pages_tags (
      page_id INTEGER REFERENCES pages (id),
      tag_id INTEGER REFERENCES tags (id),
      PRIMARY KEY (page_id, tag_id)
    );`)
  } else {
    await db.query(sql`CREATE TABLE categories (
      id INTEGER PRIMARY KEY,
      name VARCHAR(42)
    );`)
    await db.query(sql`CREATE TABLE pages (
      id INTEGER PRIMARY KEY,
      title VARCHAR(42),
      category_id INTEGER,
      FOREIGN KEY (category_id) REFERENCES categories(id)
    );`)
    await db.query(sql`CREATE TABLE tags (
      id INTEGER PRIMARY KEY,
      name VARCHAR(42)
    );`)
    await db.query(sql`CREATE TABLE pages_tags (
      page_id INTEGER REFERENCES pages (id),
      tag_id INTEGER REFERENCES tags (id),
      PRIMARY KEY (page_id, tag_id)
    );`)
  }
}

test('ignore root GET route', async ({ pass, teardown, equal, ok }) => {
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
      pages: {
        routes: {
          GET: ['/pages/']
        }
      }
    }
  })
  teardown(app.close.bind(app))

  await app.ready()

  const { statusCode, body } = await app.inject({ method: 'GET', url: '/documentation/json' })
  equal(statusCode, 200, 'GET /documentation/json status code')

  const openApiDocs = JSON.parse(body)
  const rootEntityMethods = Object.keys(openApiDocs.paths['/pages/'])
  const entityMethods = Object.keys(openApiDocs.paths['/pages/{id}'])

  ok(!rootEntityMethods.includes('get'), 'GET /pages/ is ignored')
  ok(entityMethods.includes('get'), true, 'GET /pages/{id} is not ignored')

  ok(openApiDocs.paths['/pages/{id}/category'], 'GET /pages/{id}/category is not ignored')
})

test('ignore entity GET route', async ({ pass, teardown, equal, ok }) => {
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
      pages: {
        routes: {
          GET: ['/pages/:id']
        }
      }
    }
  })
  teardown(app.close.bind(app))

  await app.ready()

  const { statusCode, body } = await app.inject({ method: 'GET', url: '/documentation/json' })
  equal(statusCode, 200, 'GET /documentation/json status code')

  const openApiDocs = JSON.parse(body)
  const rootEntityMethods = Object.keys(openApiDocs.paths['/pages/'])
  const entityMethods = Object.keys(openApiDocs.paths['/pages/{id}'])

  ok(rootEntityMethods.includes('get'), 'GET /pages/ is not ignored')
  ok(!entityMethods.includes('get'), 'GET /pages/{id} is ignored')

  ok(openApiDocs.paths['/pages/{id}/category'], 'GET /pages/{id}/category is not ignored')
})

test('ignore entity references routes', async ({ pass, teardown, equal, ok }) => {
  const app = fastify()
  app.register(sqlMapper, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      pass('onDatabaseLoad called')

      await clear(db, sql)
      await createBasicPages(db, sql)
    }
  })

  // TODO: remove after fixing mysql many-to-many
  const manyToManyURL = (isMysql && !isMariaDB)
    ? '/pagesTags/pageId/:pageId/tagId/:tagId'
    : '/pagesTags/page/:pageId/tag/:tagId'

  app.register(sqlOpenAPI, {
    ignore: {
      pagesTags: {
        routes: {
          POST: ['/pagesTags/'],
          GET: [manyToManyURL],
          PUT: [manyToManyURL],
          DELETE: [manyToManyURL]
        }
      },
      categories: {
        routes: {
          GET: ['/categories/:id/pages']
        }
      }
    }
  })
  teardown(app.close.bind(app))

  await app.ready()

  const { statusCode, body } = await app.inject({ method: 'GET', url: '/documentation/json' })
  equal(statusCode, 200, 'GET /documentation/json status code')

  const openApiDocs = JSON.parse(body)

  // TODO: remove after fixing mysql many-to-many
  const manyToManySwaggerURL = (isMysql && !isMariaDB)
    ? '/pagesTags/pageId/{pageId}/tagId/{tagId}'
    : '/pagesTags/page/{pageId}/tag/{tagId}'

  const rootEntityMethods = Object.keys(openApiDocs.paths['/pagesTags/'])
  const entityMethods = Object.keys(openApiDocs.paths[manyToManySwaggerURL])

  ok(rootEntityMethods.includes('get'), 'GET /pagesTags/ is not ignored')
  ok(!rootEntityMethods.includes('post'), 'POST /pagesTags/ is ignored')

  ok(entityMethods.includes('post'), 'POST /pagesTags/page/{pageId/tag/{tagId} is not ignored')
  ok(!entityMethods.includes('get'), 'GET /pagesTags/page/{pageId/tag/{tagId} is ignored')
  ok(!entityMethods.includes('put'), 'PUT /pagesTags/page/{pageId/tag/{tagId} is ignored')
  ok(!entityMethods.includes('delete'), 'DELETE /pagesTags/page/{pageId/tag/{tagId} is ignored')

  ok(!openApiDocs.paths['/categories/:id/pages'], 'GET /categories/:id/pages is ignored')
})

test('ignore all GET routes', async ({ pass, teardown, equal, ok }) => {
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
      pages: {
        routes: {
          GET: ['/pages/', '/pages/:id', '/pages/:id/category']
        }
      }
    }
  })
  teardown(app.close.bind(app))

  await app.ready()

  const { statusCode, body } = await app.inject({ method: 'GET', url: '/documentation/json' })
  equal(statusCode, 200, 'GET /documentation/json status code')

  const openApiDocs = JSON.parse(body)
  const rootEntityMethods = Object.keys(openApiDocs.paths['/pages/'])
  const entityMethods = Object.keys(openApiDocs.paths['/pages/{id}'])

  ok(!rootEntityMethods.includes('get'), 'GET /pages/ is ignored')
  ok(!entityMethods.includes('get'), 'GET /pages/{id} is ignored')

  ok(!openApiDocs.paths['/pages/{id}/category'], 'GET /pages/{id}/category is ignored')
})

test('ignore POST methods', async ({ pass, teardown, equal, ok }) => {
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
      pages: {
        routes: {
          POST: ['/pages/', '/pages/:id']
        }
      }
    }
  })
  teardown(app.close.bind(app))

  await app.ready()

  const { statusCode, body } = await app.inject({ method: 'GET', url: '/documentation/json' })
  equal(statusCode, 200, 'GET /documentation/json status code')

  const openApiDocs = JSON.parse(body)
  const rootEntityMethods = Object.keys(openApiDocs.paths['/pages/'])
  const entityMethods = Object.keys(openApiDocs.paths['/pages/{id}'])

  ok(!rootEntityMethods.includes('post'), 'POST /pages/ is ignored')
  ok(!entityMethods.includes('post'), 'POST /pages/{id} is ignored')
})

test('ignore PUT methods', async ({ pass, teardown, equal, ok }) => {
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
      pages: {
        routes: {
          PUT: ['/pages/', '/pages/:id']
        }
      }
    }
  })
  teardown(app.close.bind(app))

  await app.ready()

  const { statusCode, body } = await app.inject({ method: 'GET', url: '/documentation/json' })
  equal(statusCode, 200, 'GET /documentation/json status code')

  const openApiDocs = JSON.parse(body)
  const rootEntityMethods = Object.keys(openApiDocs.paths['/pages/'])
  const entityMethods = Object.keys(openApiDocs.paths['/pages/{id}'])

  ok(!rootEntityMethods.includes('put'), 'PUT /pages/ is ignored')
  ok(!entityMethods.includes('put'), 'PUT /pages/{id} is ignored')
})

test('ignore DELETE methods', async ({ pass, teardown, equal, ok }) => {
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
      pages: {
        routes: {
          DELETE: ['/pages/:id']
        }
      }
    }
  })
  teardown(app.close.bind(app))

  await app.ready()

  const { statusCode, body } = await app.inject({ method: 'GET', url: '/documentation/json' })
  equal(statusCode, 200, 'GET /documentation/json status code')

  const openApiDocs = JSON.parse(body)
  const entityMethods = Object.keys(openApiDocs.paths['/pages/{id}'])
  ok(!entityMethods.includes('delete'), 'DELETE /pages/{id} is ignored')
})
