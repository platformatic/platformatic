'use strict'

const { test } = require('tap')
const fastify = require('fastify')
const sqlOpenAPI = require('..')
const sqlMapper = require('@platformatic/sql-mapper')
const { clear, connInfo, isSQLite } = require('./helper')

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
  } else {
    await db.query(sql`CREATE TABLE categories (
      id SERIAL PRIMARY KEY,
      name VARCHAR(42)
    );`)
    await db.query(sql`CREATE TABLE pages (
      id SERIAL PRIMARY KEY,
      title VARCHAR(42),
      category_id INTEGER,
      CONSTRAINT category_fk FOREIGN KEY (category_id) REFERENCES categories (id)
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
  ok(!entityMethods.includes('get'), true, 'GET /pages/{id} is ignored')

  ok(openApiDocs.paths['/pages/{id}/category'], 'GET /pages/{id}/category is not ignored')
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

  equal(rootEntityMethods.includes('get'), false, 'GET /pages/ is ignored')
  equal(entityMethods.includes('get'), false, 'GET /pages/{id} is ignored')

  equal(openApiDocs.paths['/pages/{id}/category'], undefined, 'GET /pages/{id}/category is ignored')
})

test('ignore POST methods', async ({ pass, teardown, equal }) => {
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

  equal(rootEntityMethods.includes('post'), false, 'POST /pages/ is ignored')
  equal(entityMethods.includes('post'), false, 'POST /pages/{id} is ignored')
})

test('ignore PUT methods', async ({ pass, teardown, equal }) => {
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

  equal(rootEntityMethods.includes('put'), false, 'PUT /pages/ is ignored')
  equal(entityMethods.includes('put'), false, 'PUT /pages/{id} is ignored')
})

test('ignore DELETE methods', async ({ pass, teardown, equal }) => {
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
  equal(entityMethods.includes('delete'), false, 'DELETE /pages/{id} is ignored')
})
