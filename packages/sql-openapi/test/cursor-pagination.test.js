'use strict'

const { clear, connInfo, isSQLite, isMysql } = require('./helper')
const { deepEqual: same, equal, ok: pass } = require('node:assert/strict')
const Snap = require('@matteo.collina/snap')
const { test } = require('node:test')
const fastify = require('fastify')
const sqlOpenAPI = require('..')
const sqlMapper = require('@platformatic/sql-mapper')
const { PrimaryKeyNotIncludedInOrderByInCursorPaginationError, UnableToDecodeCursor } = require('../lib/errors')

const snap = Snap(__filename)

test('cursor pagination basics', async (t) => {
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
            created_at INTEGER
          );`)
      } else if (isMysql) {
        await db.query(sql`CREATE TABLE posts (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            title VARCHAR(42),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );`)
      } else {
        await db.query(sql`CREATE TABLE posts (
            id SERIAL PRIMARY KEY,
            title VARCHAR(42),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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

  const posts = []
  for (let i = 1; i <= 10; i++) {
    const body = {
      title: `Post ${i}`,
      createdAt: Date.now() - (i * 1000)
    }
    const res = await app.inject({
      method: 'POST',
      url: '/posts',
      body
    })
    equal(res.statusCode, 200, `POST /posts ${i} status code`)
    posts.push(res.json())
  }

  // Cursor pagination by id
  {
    const res1 = await app.inject({
      method: 'GET',
      url: '/posts?limit=3&cursor=true&orderby.id=asc'
    })
    equal(res1.statusCode, 200, 'GET first page status code')
    same(res1.json().length, 3, 'First page has 3 items')

    const startAfter = res1.headers['x-start-after']
    const endBefore = res1.headers['x-end-before']

    equal(typeof startAfter, 'string', 'Start-After header present')
    equal(typeof endBefore, 'string', 'End-Before header present')

    const res2 = await app.inject({
      method: 'GET',
      url: `/posts?limit=3&startAfter=${startAfter}&orderby.id=asc`
    })
    equal(res2.statusCode, 200, 'GET next page status code')
    same(res2.json().length, 3, 'Next page has 3 items')
    same(res2.json()[0].id, 4, 'Next page starts with correct item')

    const res3 = await app.inject({
      method: 'GET',
      url: `/posts?limit=3&endBefore=${endBefore}&orderby.id=asc`
    })
    equal(res3.statusCode, 200, 'GET previous page status code')
    same(res3.json().length, 0, 'Previous page is empty (as expected)')
  }

  // Compound cursor with multiple fields
  {
    const res1 = await app.inject({
      method: 'GET',
      url: '/posts?limit=3&cursor=true&orderby.createdAt=desc&orderby.id=asc'
    })
    equal(res1.statusCode, 200, 'GET first page with compound cursor status code')
    same(res1.json().length, 3, 'First page has 3 items')
    const startAfter = res1.headers['x-start-after']

    const res2 = await app.inject({
      method: 'GET',
      url: `/posts?limit=3&startAfter=${startAfter}&orderby.createdAt=desc&orderby.id=asc`
    })
    equal(res2.statusCode, 200, 'GET next page with compound cursor status code')
    same(res2.json().length, 3, 'Next page has 3 items')

    const nextStartAfter = res2.headers['x-start-after']
    const res3 = await app.inject({
      method: 'GET',
      url: `/posts?limit=3&startAfter=${nextStartAfter}&orderby.createdAt=desc&orderby.id=asc`
    })
    equal(res3.statusCode, 200, 'GET third page status code')
    same(res3.json().length, 3, 'Third page has 3 items')
    const endBefore = res3.headers['x-end-before']

    // Go back to second page using endBefore
    const res4 = await app.inject({
      method: 'GET',
      url: `/posts?limit=3&endBefore=${endBefore}&orderby.createdAt=desc&orderby.id=asc`
    })
    equal(res4.statusCode, 200, 'GET back to second page status code')
    same(res4.json().length, 3, 'Second page has 3 items')
    same(res4.json()[0].id, res2.json()[0].id, 'Returned to correct page')
  }

  {
    const res1 = await app.inject({
      method: 'GET',
      url: '/posts?limit=2&cursor=true&where.title.like=Post%&orderby.id=asc'
    })
    equal(res1.statusCode, 200, 'GET page with where condition status code')
    same(res1.json().length, 2, 'Page has 2 items')

    const startAfter = res1.headers['x-start-after']

    const res2 = await app.inject({
      method: 'GET',
      url: `/posts?limit=2&startAfter=${startAfter}&where.title.like=Post%&orderby.id=asc`
    })
    equal(res2.statusCode, 200, 'GET next page with where condition status code')
    same(res2.json().length, 2, 'Next page has 2 items')
    same(res2.json()[0].id, 3, 'Next page starts with correct item')
  }
})

test('cursor pagination edge cases', async (t) => {
  const app = fastify()
  app.register(sqlMapper, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      pass('onDatabaseLoad called')

      await clear(db, sql)

      if (isSQLite) {
        await db.query(sql`CREATE TABLE items (
            id INTEGER PRIMARY KEY,
            name VARCHAR(42),
            category VARCHAR(42),
            score INTEGER
          );`)
      } else if (isMysql) {
        await db.query(sql`CREATE TABLE items (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(42),
            category VARCHAR(42),
            score INTEGER
          );`)
      } else {
        await db.query(sql`CREATE TABLE items (
            id SERIAL PRIMARY KEY,
            name VARCHAR(42),
            category VARCHAR(42),
            score INTEGER
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

  const itemsToCreate = [
    { name: 'Item A1', category: 'A' },
    { name: 'Item A2', category: 'A' },
    { name: 'Item A3', category: 'A', },
  ]

  for (const item of itemsToCreate) {
    const res = await app.inject({
      method: 'POST',
      url: '/items',
      body: item
    })
    equal(res.statusCode, 200, `POST /items ${item.name} status code`)
  }

  // test pagination with category ordering, using ID as tiebreaker
  {
    const res1 = await app.inject({
      method: 'GET',
      url: '/items?cursor=true&orderby.category=asc&orderby.id=desc'
    })
    equal(res1.statusCode, 200, 'First page with category ordering')
    same(res1.json().length, 3, 'First page has 3 items')

    equal(res1.json()[0].category, 'A', 'First item is category A')
    equal(res1.json()[1].category, 'A', 'Second item is category A')
    equal(res1.json()[2].category, 'A', 'Third item is category A')

    equal(res1.json()[0].id > res1.json()[1].id, true, 'First A item has higher ID than second')
    equal(res1.json()[1].id > res1.json()[2].id, true, 'Second A item has higher ID than third')
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: '/items?cursor=true&orderby.category=asc'
    })
    equal(res.statusCode, 400, 'Should fail when no primary key in orderby')
    equal(res.json().code, new PrimaryKeyNotIncludedInOrderByInCursorPaginationError().code)
  }

  {
    const startAfter = 'some-cursor-value'
    const endBefore = 'some-other-cursor-value'

    const res = await app.inject({
      method: 'GET',
      url: `/items?startAfter=${startAfter}&endBefore=${endBefore}&orderby.id=asc`
    })
    equal(res.statusCode, 400, 'Using both startAfter and endBefore should fail')
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: '/items?cursor=true&where.name.eq=NonExistentItem&orderby.id=asc'
    })
    equal(res.statusCode, 200, 'Empty results should not error')
    same(res.json(), [], 'Response should be empty array')
    equal(res.headers['x-start-after'], undefined, 'No cursor headers on empty results')
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: '/items?startAfter=invalid-cursor-value'
    })
    equal(res.statusCode, 400, 'Invalid cursor should return 400')
    equal(res.json().code, new UnableToDecodeCursor().code)
  }
})
