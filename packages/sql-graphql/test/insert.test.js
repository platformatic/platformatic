'use strict'

const { clear, connInfo, isSQLite, isPg } = require('./helper')
const { test } = require('tap')
const sqlGraphQL = require('..')
const sqlMapper = require('@platformatic/sql-mapper')
const fastify = require('fastify')

test('batch inserts', async ({ pass, teardown, same, equal }) => {
  const app = fastify()
  app.register(sqlMapper, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      pass('onDatabaseLoad called')

      await clear(db, sql)

      if (isSQLite) {
        await db.query(sql`CREATE TABLE pages (
          id INTEGER PRIMARY KEY,
          title VARCHAR(42)
        );`)
      } else {
        await db.query(sql`CREATE TABLE pages (
          id SERIAL PRIMARY KEY,
          title VARCHAR(42)
        );`)
      }
    }
  })
  app.register(sqlGraphQL)
  teardown(app.close.bind(app))

  await app.ready()

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
          mutation batch($inputs : [PageInput]!) {
            insertPages (inputs: $inputs) {
              id
              title
            }
          }
        `,
        variables: {
          inputs: [
            { title: 'Page 1' },
            { title: 'Page 2' },
            { title: 'Page 3' }
          ]
        }
      }
    })
    equal(res.statusCode, 200, 'savePage status code')
    same(res.json(), {
      data: {
        insertPages: [
          { id: 1, title: 'Page 1' },
          { id: 2, title: 'Page 2' },
          { id: 3, title: 'Page 3' }
        ]
      }
    }, 'savePage response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
          query {
            pages {
              id
              title
            }
          }
        `
      }
    })
    equal(res.statusCode, 200, 'pages status code')
    same(res.json(), {
      data: {
        pages: [
          { id: 1, title: 'Page 1' },
          { id: 2, title: 'Page 2' },
          { id: 3, title: 'Page 3' }
        ]
      }
    }, 'pages response')
  }
})

test('[PG] - batch inserts UUID', { skip: !isPg }, async ({ pass, teardown, same, equal, match }) => {
  const app = fastify()
  app.register(sqlMapper, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      pass('onDatabaseLoad called')

      await clear(db, sql)

      await db.query(sql`
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
      CREATE TABLE pages (
        id uuid PRIMARY KEY default uuid_generate_v1(),
        title VARCHAR(42)
      );`)
    }
  })
  app.register(sqlGraphQL)
  teardown(app.close.bind(app))

  await app.ready()

  let ids
  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
          mutation batch($inputs : [PageInput]!) {
            insertPages (inputs: $inputs) {
              id
              title
            }
          }
        `,
        variables: {
          inputs: [
            { title: 'Page 1' },
            { title: 'Page 2' },
            { title: 'Page 3' }
          ]
        }
      }
    })
    equal(res.statusCode, 200, 'savePage status code')
    ids = res.json().data.insertPages
    match(res.json(), {
      data: {
        insertPages: [
          { title: 'Page 1' },
          { title: 'Page 2' },
          { title: 'Page 3' }
        ]
      }
    }, 'insertPages response')
  }

  for (const { id, title } of ids) {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
          query {
            getPageById(id: "${id}") {
              id
              title
            }
          }
        `
      }
    })
    equal(res.statusCode, 200, 'getPageById status code')
    same(res.json(), {
      data: {
        getPageById: {
          id,
          title
        }
      }
    }, 'getPageById response')
  }
})
