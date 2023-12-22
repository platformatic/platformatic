'use strict'

const { clear, connInfo, isSQLite } = require('./helper')
const { test } = require('tap')
const fastify = require('fastify')
const sqlOpenAPI = require('..')
const sqlMapper = require('@platformatic/sql-mapper')

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

test('path schema override', async ({ pass, teardown, equal }) => {
  const customSummary1 = 'Custom summary 1'
  const customDescription1 = 'Custom description 1'
  const customSummary2 = 'Custom summary 2'
  const customDescription2 = 'Custom description 2'

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
      category: true
    },
    paths: {
      '/pages': {
        summary: customSummary1,
        description: customDescription1,
        put: {
          summary: customSummary2,
          description: customDescription2
        }
      }
    }
  })
  teardown(app.close.bind(app))

  await app.ready()

  {
    const res = await app.inject({
      method: 'GET',
      url: '/documentation/json'
    })

    equal(res.statusCode, 200, 'GET /documentation/json status code')
    const data = res.json()

    equal(data.paths['/pages/'].get.summary, customSummary1, 'Path level summary override')
    equal(data.paths['/pages/'].get.description, customDescription1, 'Path level description override')

    equal(data.paths['/pages/'].put.summary, customSummary2, 'Method specific summary override')
    equal(data.paths['/pages/'].put.description, customDescription2, 'Method specific description override')
  }
})
