'use strict'

const { clear, connInfo, isSQLite, isMysql } = require('./helper')
const { deepEqual: same, equal, ok: pass } = require('node:assert/strict')
const Snap = require('@matteo.collina/snap')
const { test } = require('node:test')
const fastify = require('fastify')
const sqlOpenAPI = require('..')
const sqlMapper = require('@platformatic/sql-mapper')

const snap = Snap(__filename)

test('updateMany', async (t) => {
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
          id INTEGER UNSIGNED AUTO_INCREMENT PRIMARY KEY,
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
    },
  })
  app.register(sqlOpenAPI)
  t.after(() => app.close())

  await app.ready()

  {
    const res = await app.inject({
      method: 'GET',
      url: '/documentation/json',
    })
    const openapi = res.json()
    const snapshot = await snap(openapi)
    same(openapi, snapshot)
  }

  const posts = [{
    title: 'Dog',
    longText: 'Foo',
    counter: 10,
  }, {
    title: 'Cat',
    longText: 'Bar',
    counter: 20,
  }, {
    title: 'Mouse',
    longText: 'Baz',
    counter: 30,
  }, {
    title: 'Duck',
    longText: 'A duck tale',
    counter: 40,
  }]

  for (const body of posts) {
    const res = await app.inject({
      method: 'POST',
      url: '/posts',
      body,
    })
    equal(res.statusCode, 200, 'POST /posts status code')
  }

  {
    const res = await app.inject({
      method: 'PUT',
      url: '/posts?where.counter.in=30,40',
      body: {
        title: 'Updated title',
      },
    })
    equal(res.statusCode, 200, '/posts?where.counter.in=30,40 status code')
    same(res.json(), [{
      id: 3,
      title: 'Updated title',
      longText: 'Baz',
      counter: 30,
    }, {
      id: 4,
      title: 'Updated title',
      longText: 'A duck tale',
      counter: 40,
    }], '/posts?where.counter.in=30,40 response')
  }

  {
    const res = await app.inject({
      method: 'PUT',
      url: '/posts?where.longText.in=Foo,Bar',
      body: {
        longText: 'Updated long text (1)',
      },
    })
    equal(res.statusCode, 200, 'PUT /posts?where.longText.in=Foo,Bar status code')
    same(res.json(), [{
      id: 1,
      title: 'Dog',
      longText: 'Updated long text (1)',
      counter: 10,
    }, {
      id: 2,
      title: 'Cat',
      longText: 'Updated long text (1)',
      counter: 20,
    }], 'PUT /posts?where.longText.in=Foo,Bar response')
  }

  {
    const res = await app.inject({
      method: 'PUT',
      url: '/posts?where.id.in=1,2',
      body: {
        longText: 'Updated long text (2)',
      },
    })
    equal(res.statusCode, 200, 'PUT /posts?where.id.in=1,2 status code')
    same(res.json(), [{
      id: 1,
      title: 'Dog',
      longText: 'Updated long text (2)',
      counter: 10,
    }, {
      id: 2,
      title: 'Cat',
      longText: 'Updated long text (2)',
      counter: 20,
    }], 'PUT /posts?where.id.in=1,2 response')
  }

  {
    const res = await app.inject({
      method: 'PUT',
      url: '/posts?where.id.in=2&where.title.eq=Cat',
      body: {
        title: 'Kitten',
      },
    })
    equal(res.statusCode, 200, 'PUT /posts?where.counter.gte=2&where.title.eq=Cat status code')
    same(res.json(), [{
      id: 2,
      title: 'Kitten',
      longText: 'Updated long text (2)',
      counter: 20,
    }], 'PUT /posts?where.counter.gte=2&where.title.eq=Cat response')
  }

  {
    const res = await app.inject({
      method: 'PUT',
      url: '/posts?where.id.in=2&where.title.eq=Kitten&fields=id&fields=title',
      body: {
        title: 'Cat',
      },
    })
    equal(res.statusCode, 200, '/posts?where.id.in=2&where.title.eq=Kitten&fields=id&fields=title status code')
    same(res.json(), [{
      id: 2,
      title: 'Cat',
    }], '/posts?where.id.in=2&where.title.eq=Kitten&fields=id&fields=title response')
  }

  {
    const res = await app.inject({
      method: 'PUT',
      url: '/posts?where.title.in=Cat,Dog',
      body: {
        title: 'Best pet friends',
      },
    })
    equal(res.statusCode, 200, 'PUT /posts?where.title.in=Cat,Dog status code')
    same(res.json(), [{
      id: 1,
      title: 'Best pet friends',
      longText: 'Updated long text (2)',
      counter: 10,
    }, {
      id: 2,
      title: 'Best pet friends',
      longText: 'Updated long text (2)',
      counter: 20,
    }], 'PUT /posts?where.title.in=Cat,Dog response')
  }

  {
    const res = await app.inject({
      method: 'PUT',
      url: '/post?where.id.in=1,2',
      body: {},
    })
    equal(res.statusCode, 404, 'PUT /post?where.id.in=1,2 status code')
    same(res.json(), {
      message: 'Route PUT:/post?where.id.in=1,2 not found',
      error: 'Not Found',
      statusCode: 404,
    }, 'PUT /post?where.id.in=1,2 response')
  }
})
