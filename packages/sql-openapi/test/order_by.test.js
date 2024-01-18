'use strict'

const { clear, connInfo, isSQLite, isMysql } = require('./helper')
const { deepEqual: same, equal, ok: pass } = require('node:assert')
const { test } = require('node:test')
const fastify = require('fastify')
const Snap = require('@matteo.collina/snap')
const sqlOpenAPI = require('..')
const sqlMapper = require('@platformatic/sql-mapper')

const snap = Snap(__filename)

test('one-level order by', async (t) => {
  const app = fastify()
  app.register(sqlMapper, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      pass('onDatabaseLoad called')

      await clear(db, sql)

      if (isSQLite) {
        await db.query(sql`CREATE TABLE pages (
          id INTEGER PRIMARY KEY,
          title VARCHAR(42),
          counter INTEGER
        );`)
      } else if (isMysql) {
        await db.query(sql`CREATE TABLE pages (
          id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          title VARCHAR(42),
          counter INTEGER
        );`)
      } else {
        await db.query(sql`CREATE TABLE pages (
          id SERIAL PRIMARY KEY,
          title VARCHAR(42),
          counter INTEGER
        );`)
      }
    }
  })
  app.register(sqlOpenAPI)
  t.after(() => app.close())

  await app.ready()

  {
    const pages = [
      { title: 'Page 1', counter: 3 },
      { title: 'Page 2', counter: 2 },
      { title: 'Page 3', counter: 1 }
    ]
    const expected = [
      { id: 1, title: 'Page 1', counter: 3 },
      { id: 2, title: 'Page 2', counter: 2 },
      { id: 3, title: 'Page 3', counter: 1 }
    ]

    for (const body of pages) {
      const res = await app.inject({
        method: 'POST',
        url: '/pages',
        body
      })
      equal(res.statusCode, 200, 'POST /pages status code')
      same(res.json(), expected.shift(), 'POST /pages response')
    }
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: '/pages?orderby.counter=asc&fields=id,title,counter'
    })
    equal(res.statusCode, 200, 'GET /pages?orderby.counter=asc status code')
    same(res.json(), [
      { id: 3, title: 'Page 3', counter: 1 },
      { id: 2, title: 'Page 2', counter: 2 },
      { id: 1, title: 'Page 1', counter: 3 }
    ], 'GET /pages?orderby.counter=asc response')
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: '/pages?orderby.counter=desc&fields=id,title,counter'
    })
    equal(res.statusCode, 200, 'GET /pages?orderby.counter=desc status code')
    same(res.json(), [
      { id: 1, title: 'Page 1', counter: 3 },
      { id: 2, title: 'Page 2', counter: 2 },
      { id: 3, title: 'Page 3', counter: 1 }
    ], 'GET /pages?orderby.counter=desc response')
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: '/documentation/json'
    })
    const json = res.json()
    const snapshot = await snap(json)
    same(json, snapshot)
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: '/pages?orderby.counter=xxxx'
    })
    equal(res.statusCode, 400, 'GET /pages?orderby.counter=desc status code')
    same(res.json(), {
      statusCode: 400,
      code: 'FST_ERR_VALIDATION',
      error: 'Bad Request',
      message: 'querystring/orderby.counter must be equal to one of the allowed values'
    }
    , 'GET /pages?orderby.counter=desc response')
  }
})

test('list order by', async (t) => {
  const app = fastify()
  app.register(sqlMapper, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      pass('onDatabaseLoad called')

      await clear(db, sql)

      if (isSQLite) {
        await db.query(sql`CREATE TABLE pages (
          id INTEGER PRIMARY KEY,
          counter INTEGER,
          counter2 INTEGER
        );`)
      } else {
        await db.query(sql`CREATE TABLE pages (
          id SERIAL PRIMARY KEY,
          counter INTEGER,
          counter2 INTEGER
        );`)
      }
    }
  })
  app.register(sqlOpenAPI)
  t.after(() => app.close())

  await app.ready()

  {
    const res = await app.platformatic.entities.page.insert({
      inputs: [
        { counter: 3, counter2: 3 },
        { counter: 3, counter2: 2 },
        { counter: 1, counter2: 1 }
      ]
    })
    same(res, [
      { id: '1', counter: 3, counter2: 3 },
      { id: '2', counter: 3, counter2: 2 },
      { id: '3', counter: 1, counter2: 1 }
    ])
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: '/pages?orderby.counter=asc&orderby.counter2=desc&fields=id,counter,counter2'
    })
    equal(res.statusCode, 200, 'GET /pages?orderby.counter=asc&orderby.counter2=desc status code')
    same(res.json(), [
      { id: 3, counter: 1, counter2: 1 },
      { id: 1, counter: 3, counter2: 3 },
      { id: 2, counter: 3, counter2: 2 }
    ], 'GET /pages?orderby.counter=asc&orderby.counter2=desc response')
  }
})
