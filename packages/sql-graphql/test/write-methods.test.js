import sqlMapper from '@platformatic/sql-mapper'
import fastify from 'fastify'
import { deepEqual, equal, ok } from 'node:assert'
import { test } from 'node:test'
import sqlGraphQL from '../index.js'
import { clear, connInfo, isSQLite } from './helper.js'

async function setup (t) {
  const app = fastify()
  app.register(sqlMapper, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      await clear(db, sql)
      if (isSQLite) {
        await db.query(sql`DROP TABLE IF EXISTS sheep`)
      } else {
        await db.query(sql`DROP TABLE IF EXISTS sheep CASCADE`)
      }
      if (isSQLite) {
        await db.query(sql`CREATE TABLE pages (id INTEGER PRIMARY KEY, title VARCHAR(42));`)
        await db.query(sql`CREATE TABLE sheep (id INTEGER PRIMARY KEY, title VARCHAR(42));`)
      } else {
        await db.query(sql`CREATE TABLE pages (id SERIAL PRIMARY KEY, title VARCHAR(42));`)
        await db.query(sql`CREATE TABLE sheep (id SERIAL PRIMARY KEY, title VARCHAR(42));`)
      }
    }
  })
  app.register(sqlGraphQL)
  t.after(() => app.close())
  await app.ready()
  return app
}

async function graphql (app, query) {
  const response = await app.inject({ method: 'POST', url: '/graphql', body: { query } })
  equal(response.statusCode, 200)
  return response.json()
}

test('exposes explicit insert, update and upsert mutations and the deprecated save alias', async t => {
  const app = await setup(t)

  deepEqual(await graphql(app, `mutation {
    insertPage(input: { title: "inserted" }) { id title }
  }`), {
    data: { insertPage: { id: 1, title: 'inserted' } }
  })

  deepEqual(await graphql(app, `mutation {
    updatePage(input: { id: 1, title: "updated" }) { id title }
  }`), {
    data: { updatePage: { id: 1, title: 'updated' } }
  })

  deepEqual(await graphql(app, `mutation {
    updatePage(input: { id: 99, title: "missing" }) { id title }
  }`), {
    data: { updatePage: null }
  })

  deepEqual(await graphql(app, `mutation {
    upsertPage(input: { id: 2, title: "upserted" }) { id title }
  }`), {
    data: { upsertPage: { id: 2, title: 'upserted' } }
  })

  deepEqual(await graphql(app, `mutation {
    savePage(input: { id: 2, title: "legacy" }) { id title }
  }`), {
    data: { savePage: { id: 2, title: 'legacy' } }
  })

  const introspection = await graphql(app, `query {
    __type(name: "Mutation") {
      fields(includeDeprecated: true) { name isDeprecated deprecationReason }
    }
  }`)
  const saveField = introspection.data.__type.fields.find(field => field.name === 'savePage')
  ok(saveField)
  equal(saveField.isDeprecated, true)
  equal(saveField.deprecationReason, 'Use upsertPage instead.')
})

test('keeps the bulk insert name for uncountable entities and exposes insertOne for singular writes', async t => {
  const app = await setup(t)

  deepEqual(await graphql(app, `mutation {
    insertOneSheep(input: { title: "one" }) { id title }
    insertSheep(inputs: [{ title: "two" }]) { id title }
  }`), {
    data: {
      insertOneSheep: { id: 1, title: 'one' },
      insertSheep: [{ id: 2, title: 'two' }]
    }
  })
})
