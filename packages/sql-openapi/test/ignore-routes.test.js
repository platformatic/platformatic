'use strict'

const assert = require('node:assert/strict')
const { test } = require('node:test')
const fastify = require('fastify')
const sqlMapper = require('@platformatic/sql-mapper')
const { clear, connInfo, isSQLite } = require('./helper')
const sqlOpenAPI = require('..')

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

test('ignore a root entity route', async (t) => {
  const app = fastify()
  app.register(sqlMapper, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      await clear(db, sql)
      await createBasicPages(db, sql)
    },
  })
  app.register(sqlOpenAPI, {
    ignoreRoutes: [
      { path: '/pages', method: 'GET' },
      { path: '/pages', method: 'PUT' },
    ],
  })
  t.after(() => app.close())

  await app.ready()

  {
    const res = await app.inject({ method: 'GET', url: '/pages' })
    assert.strictEqual(res.statusCode, 404)
  }
  {
    const res = await app.inject({ method: 'PUT', url: '/pages' })
    assert.strictEqual(res.statusCode, 404)
  }
  {
    const res = await app.inject({
      method: 'POST',
      url: '/pages',
      body: { title: 'hello' },
    })
    assert.strictEqual(res.statusCode, 200, res.body)
  }
})

test('ignore a parametric entity route', async (t) => {
  const app = fastify()
  app.register(sqlMapper, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      await clear(db, sql)
      await createBasicPages(db, sql)
    },
  })
  app.register(sqlOpenAPI, {
    ignoreRoutes: [
      { path: '/pages/{id}', method: 'GET' },
      { path: '/pages/{id}', method: 'PUT' },
    ],
  })
  t.after(() => app.close())

  await app.ready()

  {
    const res = await app.inject({
      method: 'POST',
      url: '/pages',
      body: { title: 'hello' },
    })
    assert.strictEqual(res.statusCode, 200, res.body)
  }
  {
    const res = await app.inject({ method: 'GET', url: '/pages' })
    assert.strictEqual(res.statusCode, 200)
  }
  {
    const res = await app.inject({ method: 'GET', url: '/pages/1' })
    assert.strictEqual(res.statusCode, 404)
  }
})
