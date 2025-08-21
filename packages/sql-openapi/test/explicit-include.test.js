import sqlMapper from '@platformatic/sql-mapper'
import fastify from 'fastify'
import { equal, ok } from 'node:assert'
import { test } from 'node:test'
import sqlOpenAPI from '../index.js'
import { clear, connInfo, createBasicPages } from './helper.js'

test('include a table', async t => {
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

test('include a table, ignore a column', async t => {
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

test('include a with sqlOpenAPI', async t => {
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
