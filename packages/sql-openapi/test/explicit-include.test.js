'use strict'

const { clear, connInfo, createBasicPages } = require('./helper')
const { tspl } = require('@matteo.collina/tspl')
const { test } = require('node:test')
const fastify = require('fastify')
const sqlOpenAPI = require('..')
const sqlMapper = require('@platformatic/sql-mapper')

test('include a table', async (t) => {
  const { ok, equal } = tspl(t, { plan: 3 })
  const app = fastify()
  app.register(sqlMapper, {
    ...connInfo,
    include: {
      categories: true
    },
    async onDatabaseLoad (db, sql) {
      ok('onDatabaseLoad called')
      await clear(db, sql)
      await createBasicPages(db, sql)
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
    equal(res.statusCode, 200, 'GET /documentation/json status code')
    const data = res.json()
    equal(data.components.schemas.Category.title, 'Category')
  }
})

test('include a table, ignore a column', async (t) => {
  const { ok, equal } = tspl(t, { plan: 4 })
  const app = fastify()
  app.register(sqlMapper, {
    ...connInfo,
    include: {
      categories: true
    },
    ignore: {
      categories: {
        name: true
      }
    },
    async onDatabaseLoad (db, sql) {
      ok('onDatabaseLoad called')
      await clear(db, sql)
      await createBasicPages(db, sql)
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
    equal(res.statusCode, 200, 'GET /documentation/json status code')
    const data = res.json()
    equal(data.components.schemas.Category.title, 'Category')
    equal(data.components.schemas.Category.properties.name, undefined, 'name property is ignored')
  }
})

test('include a with sqlOpenAPI', async (t) => {
  const { ok, equal } = tspl(t, { plan: 3 })
  const app = fastify()
  app.register(sqlMapper, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      ok('onDatabaseLoad called')
      await clear(db, sql)
      await createBasicPages(db, sql)
    }
  })
  app.register(sqlOpenAPI, {
    include: {
      category: true
    }
  })
  t.after(() => app.close())

  await app.ready()

  {
    const res = await app.inject({
      method: 'GET',
      url: '/documentation/json'
    })
    equal(res.statusCode, 200, 'GET /documentation/json status code')
    const data = res.json()
    equal(data.components.schemas.Category.title, 'Category')
  }
})
