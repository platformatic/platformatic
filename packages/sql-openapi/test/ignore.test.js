'use strict'

const { test } = require('tap')
const fastify = require('fastify')
const sqlOpenAPI = require('..')
const sqlMapper = require('@platformatic/sql-mapper')
const { clear, connInfo, isSQLite } = require('./helper')

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
