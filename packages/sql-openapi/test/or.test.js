'use strict'

const { clear, connInfo, isSQLite, isMysql } = require('./helper')
const { test } = require('node:test')
const Snap = require('@matteo.collina/snap')
const { deepEqual: same, equal, ok: pass } = require('node:assert/strict')
const fastify = require('fastify')
const sqlOpenAPI = require('..')
const sqlMapper = require('@platformatic/sql-mapper')

const snap = Snap(__filename)

test('list', async (t) => {
  const app = fastify()
  app.register(sqlMapper, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      pass('onDatabaseLoad called')

      await clear(db, sql)

      if (isSQLite) {
        await db.query(sql`CREATE TABLE posts (
          id INTEGER PRIMARY KEY,
          title VARCHAR(42),
          long_text TEXT,
          counter INTEGER
        );`)
      } else if (isMysql) {
        await db.query(sql`CREATE TABLE posts (
          id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          title VARCHAR(42),
          long_text TEXT,
          counter INTEGER
        );`)
      } else {
        await db.query(sql`CREATE TABLE posts (
          id SERIAL PRIMARY KEY,
          title VARCHAR(42),
          long_text TEXT,
          counter INTEGER
        );`)
      }
    }
  })
  app.register(sqlOpenAPI)
  t.after(() => app.close())

  await app.ready()

  {
    const res = await app.inject({
      method: 'GET',
      url: '/documentation/json'
    })
    const openapi = res.json()
    const snapshot = await snap(openapi)
    same(openapi, snapshot)
  }

  const posts = [{
    title: 'Dog',
    longText: 'Foo',
    counter: 10
  }, {
    title: 'Cat',
    longText: 'Bar',
    counter: 20
  }, {
    title: 'Mouse',
    longText: 'Baz',
    counter: 30
  }, {
    title: 'Duck',
    longText: 'A duck tale',
    counter: 40
  }]

  for (const body of posts) {
    const res = await app.inject({
      method: 'POST',
      url: '/posts',
      body
    })
    equal(res.statusCode, 200, 'POST /posts status code')
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: '/posts?where.or=(title.eq=Dog|title.eq=Cat)&fields=id,title,longText'
    })
    equal(res.statusCode, 200, 'GET /posts?where.or=(title.eq=Dog|title.eq=Cat)&fields=id,title,longText status code')
    same(res.json(), [
      { id: 1, title: 'Dog', longText: 'Foo' },
      { id: 2, title: 'Cat', longText: 'Bar' }
    ], 'GET /posts?where.or=(title.eq=Dog|title.eq=Cat)&fields=id,title,longText response')
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: '/posts?where.or=(title.eq=Dog|title.eq=Cat)&where.id.eq=1&fields=id,title,longText'
    })
    equal(res.statusCode, 200, 'GET /posts?where.or=(title.eq=Dog|title.eq=Cat)&where.id.eq=1&fields=id,title,longText status code')
    same(res.json(), [
      { id: 1, title: 'Dog', longText: 'Foo' }
    ], 'GET /posts?where.or=(title.eq=Dog|title.eq=Cat)&where.id.eq=1&fields=id,title,longText response')
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: '/posts?where.or=(counter.eq=10|counter.gte=30)&fields=id,title,longText'
    })
    equal(res.statusCode, 200, 'GET /posts?where.or=(counter.eq=10|counter.gte=30)&fields=id,title,longText status code')
    same(res.json(), [
      { id: 1, title: 'Dog', longText: 'Foo' },
      { id: 3, title: 'Mouse', longText: 'Baz' },
      { id: 4, title: 'Duck', longText: 'A duck tale' }
    ], 'GET /posts?where.or=(counter.eq=10|counter.gte=30)&fields=id,title,longText response')
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: '/posts?where.or=(title.eq=Dog|title.eq=Duck)&fields=id,title,longText'
    })
    equal(res.statusCode, 200, 'GET /posts?where.or=(title.eq=Dog|title.eq=Duck)&fields=id,title,longText status code')
    same(res.json(), [
      { id: 1, title: 'Dog', longText: 'Foo' },
      { id: 4, title: 'Duck', longText: 'A duck tale' }
    ], 'GET /posts?where.or=(title.eq=Dog|title.eq=Duck)&fields=id,title,longText response')
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: '/posts?where.or=(title.eq=Dog|longText.eq=Baz)&fields=id,title,longText'
    })
    equal(res.statusCode, 200, 'GET /posts?where.or=(title.eq=Dog|longText.eq=Baz)&fields=id,title,longText status code')
    same(res.json(), [
      { id: 1, title: 'Dog', longText: 'Foo' },
      { id: 3, title: 'Mouse', longText: 'Baz' }
    ], 'GET /posts?where.or=(title.eq=Dog|longText.eq=Baz)&fields=id,title,longText response')
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: '/posts?where.or=(title.eq=Dog|longText.eq=Baz)&where.counter.in=10,20&fields=id,title,longText'
    })
    equal(res.statusCode, 200, 'GET /posts?where.or=(title.eq=Dog|longText.eq=Baz)&where.counter.in=10,20&fields=id,title,longText status code')
    same(res.json(), [
      { id: 1, title: 'Dog', longText: 'Foo' }
    ], 'GET /posts?where.or=(title.eq=Dog|longText.eq=Baz)&where.counter.in=10,20&fields=id,title,longText response')
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: '/posts?where.or=(counter.in=10,20|counter.in=20,30)&fields=id,title,longText'
    })
    equal(res.statusCode, 200, 'GET /posts?where.or=(counter.in=10,20|counter.in=20,30)&fields=id,title,longText status code')
    same(res.json(), [
      { id: 1, title: 'Dog', longText: 'Foo' },
      { id: 2, title: 'Cat', longText: 'Bar' },
      { id: 3, title: 'Mouse', longText: 'Baz' }
    ], 'GET /posts?where.or=(counter.in=10,20|counter.in=20,30)&fields=id,title,longText response')
  }
})
