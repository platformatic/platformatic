import Snap from '@matteo.collina/snap'
import sqlMapper from '@platformatic/sql-mapper'
import fastify from 'fastify'
import { equal, ok as pass, deepEqual as same } from 'node:assert/strict'
import { test } from 'node:test'
import sqlOpenAPI from '../index.js'
import {
  CursorValidationError,
  PrimaryKeyNotIncludedInOrderByInCursorPaginationError,
  UnableToParseCursorStrError
} from '../lib/errors.js'
import { clear, connInfo, isMysql, isSQLite } from './helper.js'

const snap = Snap(import.meta.filename)

test('cursor pagination basics', async t => {
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
            created_at TIMESTAMP
          );`)
      } else if (isMysql) {
        await db.query(sql`CREATE TABLE posts (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            title VARCHAR(42),
            created_at TIMESTAMP NULL DEFAULT NULL
          );`)
      } else {
        await db.query(sql`CREATE TABLE posts (
            id SERIAL PRIMARY KEY,
            title VARCHAR(42),
            created_at TIMESTAMP
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

  const posts = []
  for (let i = 1; i <= 10; i++) {
    const body = {
      title: `Post ${i}`,
      createdAt: Date.now() - i * 1000
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

test('cursor pagination edge cases', async t => {
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
            category VARCHAR(42)
          );`)
      } else if (isMysql) {
        await db.query(sql`CREATE TABLE items (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(42),
            category VARCHAR(42)
          );`)
      } else {
        await db.query(sql`CREATE TABLE items (
            id SERIAL PRIMARY KEY,
            name VARCHAR(42),
            category VARCHAR(42)
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

  const wierdItem = { name: 'Corrupted Magic Item ÿÿÿ', category: 'ÿ' }
  const itemsToCreate = [
    { name: 'Item A1', category: 'A' },
    { name: 'Item A2', category: 'A' },
    { name: 'Item B1', category: 'B' },
    { name: 'Item B2', category: 'B' },
    wierdItem,
    { name: 'Item C1', category: 'C' }
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
      url: '/items?limit=2&cursor=true&orderby.category=asc&orderby.id=desc'
    })
    equal(res1.statusCode, 200, 'First page with category ordering')

    equal(res1.json()[0].category, 'A', 'First item is category A')
    equal(res1.json()[1].category, 'A', 'Second item is category A')
    equal(res1.json()[0].id, 2, 'First item ID is 2')
    equal(res1.json()[1].id, 1, 'Second item ID is 1')

    const startAfter = res1.headers['x-start-after']
    const res2 = await app.inject({
      method: 'GET',
      url: `/items?limit=2&startAfter=${startAfter}&orderby.category=asc&orderby.id=desc`
    })
    equal(res2.statusCode, 200, 'Second page with category ordering')
    equal(res2.json()[0].category, 'B', 'First item is category B')
    equal(res2.json()[1].category, 'B', 'Second item is category B')
    equal(res2.json()[0].id, 4, 'First item ID is 4')
    equal(res2.json()[1].id, 3, 'Second item ID is 3')
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
    const res = await app.inject({
      method: 'GET',
      url: '/items?cursor=true&where.name.eq=NonExistentItem&orderby.id=asc'
    })
    equal(res.statusCode, 200, 'Empty results should not error')
    same(res.json(), [], 'Response should be empty array')
    equal(res.headers['x-start-after'], undefined, 'No cursor headers on empty results')
  }

  // Test invalidation of cursor schema
  {
    const invalidStartAfter = Buffer.from(JSON.stringify({ id: 'start' })).toString('base64')
    const invalidEndBefore = Buffer.from(JSON.stringify({ id: 'end' })).toString('base64')
    const res = await app.inject({
      method: 'GET',
      url: `/items?startAfter=${invalidStartAfter}&orderby.id=asc`
    })
    equal(res.statusCode, 400, 'Invalid cursor should return 400')
    equal(res.json().code, new CursorValidationError().code)
    pass(res.json().message.includes('id must be integer'))

    const res1 = await app.inject({
      method: 'GET',
      url: `/items?endBefore=${invalidEndBefore}&orderby.id=asc`
    })
    equal(res1.statusCode, 400, 'Invalid cursor should return 400')
    equal(res1.json().code, new CursorValidationError().code)
    pass(res1.json().message.includes('id must be integer'))
  }

  // cursor prototype pollution: __proto__ should not be allowed
  {
    const pollutedCursor = '{"id":2,"__proto__":{"polluted":"yes"}}'
    const startAfter = Buffer.from(pollutedCursor).toString('base64')
    const res = await app.inject({
      method: 'GET',
      url: `/items?startAfter=${startAfter}&orderby.id=asc`
    })
    equal(res.statusCode, 400, 'Cursor with prototype pollution should return 400')
    equal(res.json().code, new UnableToParseCursorStrError().code)
    pass(res.json().message.includes('Object contains forbidden prototype property'))
  }

  // cursor prototype pollution: constructor.prototype should not be allowed
  {
    const pollutedCursor = '{"id":2,"constructor":{"prototype":{"bar": "baz"}}}'
    const startAfter = Buffer.from(pollutedCursor).toString('base64')
    const res = await app.inject({
      method: 'GET',
      url: `/items?startAfter=${startAfter}&orderby.id=asc`
    })
    equal(res.statusCode, 400, 'Cursor with prototype pollution should return 400')
    equal(res.json().code, new UnableToParseCursorStrError().code)
    pass(res.json().message.includes('Object contains forbidden prototype property'))
  }

  // non-JSON in base64
  {
    const startAfter = Buffer.from('some-cursor-value').toString('base64')
    const endBefore = Buffer.from('another-cursor-value').toString('base64')
    const res = await app.inject({
      method: 'GET',
      url: `/items?startAfter=${startAfter}&orderby.id=asc`
    })
    equal(res.statusCode, 400, 'Invalid cursor should return 400')
    equal(res.json().code, new UnableToParseCursorStrError().code)

    const res1 = await app.inject({
      method: 'GET',
      url: `/items?endBefore=${endBefore}&orderby.id=asc`
    })
    equal(res1.statusCode, 400, 'Invalid cursor should return 400')
    equal(res1.json().code, new UnableToParseCursorStrError().code)
  }

  // test cursor whose base64 encoding contains special characters
  {
    const wierdCursor = await app
      .inject({
        method: 'GET',
        url: `/items?where.name.eq=${wierdItem.name}`
      })
      .then(res => res.json()[0])
    const encodedCursor = Buffer.from(JSON.stringify(wierdCursor)).toString('base64')

    const res = await app.inject({
      method: 'GET',
      url: `/items?limit=1&startAfter=${encodedCursor}&orderby.id=asc&&orderby.name=asc&orderby.category=asc`
    })
    equal(res.statusCode, 200, 'Valid cursor should return 200')
    same(res.json()[0].id, wierdCursor.id + 1, 'Returned correct item')

    const res1 = await app.inject({
      method: 'GET',
      url: `/items?limit=1&endBefore=${encodedCursor}&orderby.id=asc&&orderby.name=asc&orderby.category=asc`
    })
    equal(res1.statusCode, 200, 'Valid cursor should return 200')
    same(res1.json()[0].id, wierdCursor.id - 1, 'Returned correct item')
  }

  // Both startAfter and endBefore provided. (startAfter should be used)
  {
    const res = await app.inject({
      method: 'GET',
      url: '/items?limit=2&cursor=true&orderby.id=asc'
    })
    equal(res.statusCode, 200)
    const startAfter = res.headers['x-start-after']
    const endBefore = res.headers['x-end-before']
    const lastItem = res.json().at(-1)

    const res1 = await app.inject({
      method: 'GET',
      url: `/items?limit=1&startAfter=${startAfter}&endBefore=${endBefore}&orderby.id=asc`
    })
    equal(res1.statusCode, 200)
    same(res1.json()[0].id, lastItem.id + 1, 'Returned correct item')
  }
})
