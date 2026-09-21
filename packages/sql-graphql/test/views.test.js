import sqlMapper from '@platformatic/sql-mapper'
import fastify from 'fastify'
import { equal, ok as pass, deepEqual as same } from 'node:assert'
import { test } from 'node:test'
import sqlGraphQL from '../index.js'
import { clear, connInfo, isSQLite } from './helper.js'

async function createTablesAndViews (db, sql) {
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

  await db.query(sql`INSERT INTO pages (title) VALUES ('Hello')`)
  await db.query(sql`INSERT INTO pages (title) VALUES ('World')`)

  await db.query(sql`CREATE VIEW pages_view AS SELECT title FROM pages`)
}

test('views are exposed as read-only GraphQL queries', async t => {
  const app = fastify()
  app.register(sqlMapper, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      pass('onDatabaseLoad called')

      try { await db.query(sql`DROP VIEW IF EXISTS pages_view`) } catch {}
      await clear(db, sql)
      await createTablesAndViews(db, sql)
    }
  })
  app.register(sqlGraphQL)
  t.after(() => app.close())

  await app.ready()

  // Query list should work for views
  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
          query {
            pagesView {
              title
            }
          }
        `
      }
    })
    equal(res.statusCode, 200, 'pagesView query status code')
    same(
      res.json(),
      {
        data: {
          pagesView: [
            { title: 'Hello' },
            { title: 'World' }
          ]
        }
      },
      'pagesView query response'
    )
  }

  // Count query should work for views
  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
          query {
            countPagesView {
              total
            }
          }
        `
      }
    })
    equal(res.statusCode, 200, 'countPagesView query status code')
    same(
      res.json(),
      {
        data: {
          countPagesView: {
            total: 2
          }
        }
      },
      'countPagesView query response'
    )
  }

  // Query with where filter should work
  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
          query {
            pagesView(where: { title: { eq: "Hello" } }) {
              title
            }
          }
        `
      }
    })
    equal(res.statusCode, 200, 'pagesView where query status code')
    same(
      res.json(),
      {
        data: {
          pagesView: [
            { title: 'Hello' }
          ]
        }
      },
      'pagesView where query response'
    )
  }

  // Mutations should not exist for views
  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
          mutation {
            savePagesView(input: { title: "New" }) {
              title
            }
          }
        `
      }
    })
    const body = res.json()
    equal(body.errors.length > 0, true, 'savePagesView mutation should fail')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
          mutation {
            insertPagesView(inputs: [{ title: "New" }]) {
              title
            }
          }
        `
      }
    })
    const body = res.json()
    equal(body.errors.length > 0, true, 'insertPagesView mutation should fail')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
          mutation {
            deletePagesView(where: { title: { eq: "Hello" } }) {
              title
            }
          }
        `
      }
    })
    const body = res.json()
    equal(body.errors.length > 0, true, 'deletePagesView mutation should fail')
  }
})

test('views and tables coexist in GraphQL', async t => {
  const app = fastify()
  app.register(sqlMapper, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      try { await db.query(sql`DROP VIEW IF EXISTS pages_view`) } catch {}
      await clear(db, sql)
      await createTablesAndViews(db, sql)
    }
  })
  app.register(sqlGraphQL)
  t.after(() => app.close())

  await app.ready()

  // Table mutations should work
  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
          mutation {
            savePage(input: { title: "New Page" }) {
              id
              title
            }
          }
        `
      }
    })
    equal(res.statusCode, 200, 'savePage mutation works')
    const body = res.json()
    equal(body.data.savePage.title, 'New Page')
  }

  // View should reflect the new data
  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
          query {
            pagesView {
              title
            }
          }
        `
      }
    })
    const body = res.json()
    equal(body.data.pagesView.length, 3, 'View reflects new row')
  }
})
