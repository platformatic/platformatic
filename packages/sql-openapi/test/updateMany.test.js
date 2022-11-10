'use strict'

const t = require('tap')
const fastify = require('fastify')
const sqlOpenAPI = require('..')
const sqlMapper = require('@platformatic/sql-mapper')
const { clear, connInfo, isSQLite } = require('./helper')
const { resolve } = require('path')
const { test } = t

Object.defineProperty(t, 'fullname', {
  value: 'platformatic/db/openapi/updateMany'
})

test('updateMany', async (t) => {
  const { pass, teardown, same, equal, matchSnapshot } = t
  t.snapshotFile = resolve(__dirname, 'tap-snapshots', 'updateMany-openapi-1.cjs')
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
  teardown(app.close.bind(app))

  await app.ready()

  {
    const res = await app.inject({
      method: 'GET',
      url: '/documentation/json'
    })
    const openapi = res.json()
    matchSnapshot(openapi, 'matches expected OpenAPI defs')
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
      method: 'PUT',
      url: '/posts?where.counter.gte=30',
      body: {
        title: 'Updated title'
      }
    })
    equal(res.statusCode, 200, 'PUT /posts?where.counter.gte=30 status code')
    same(res.json(), [{
      id: 3,
      title: 'Updated title',
      longText: 'Baz',
      counter: 30
    }, {
      id: 4,
      title: 'Updated title',
      longText: 'A duck tale',
      counter: 40
    }], 'PUT /posts?where.counter.gte=30 response')
  }

  {
    const res = await app.inject({
      method: 'PUT',
      url: '/posts?where.id.in=1,2',
      body: {
        longText: 'Updated long text'
      }
    })
    equal(res.statusCode, 200, 'PUT /posts?where.id.in=1,2 status code')
    same(res.json(), [{
      id: 1,
      title: 'Dog',
      longText: 'Updated long text',
      counter: 10
    }, {
      id: 2,
      title: 'Cat',
      longText: 'Updated long text',
      counter: 20
    }], 'PUT /posts?where.id.in=1,2 response')
  }

  {
    const res = await app.inject({
      method: 'PUT',
      url: '/post?where.id.in=1,2',
      body: {}
    })
    equal(res.statusCode, 404, 'PUT /post?where.id.in=1,2 status code')
    same(res.json(), {
      message: 'Route PUT:/post?where.id.in=1,2 not found',
      error: 'Not Found',
      statusCode: 404
    }, 'PUT /post?where.id.in=1,2 response')
  }
})
