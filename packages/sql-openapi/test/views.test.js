import sqlMapper from '@platformatic/sql-mapper'
import fastify from 'fastify'
import { equal, ok as pass, deepEqual as same } from 'node:assert'
import { test } from 'node:test'
import sqlOpenAPI from '../index.js'
import { clear, connInfo, isMysql, isSQLite } from './helper.js'

async function createTablesAndViews (db, sql) {
  if (isSQLite) {
    await db.query(sql`CREATE TABLE pages (
      id INTEGER PRIMARY KEY,
      title VARCHAR(42) NOT NULL
    );`)
  } else if (isMysql) {
    await db.query(sql`CREATE TABLE pages (
      id INT NOT NULL AUTO_INCREMENT UNIQUE PRIMARY KEY,
      title VARCHAR(42) NOT NULL
    );`)
  } else {
    await db.query(sql`CREATE TABLE pages (
      id SERIAL PRIMARY KEY,
      title VARCHAR(42) NOT NULL
    );`)
  }

  await db.query(sql`INSERT INTO pages (title) VALUES ('Hello')`)
  await db.query(sql`INSERT INTO pages (title) VALUES ('World')`)

  await db.query(sql`CREATE VIEW pages_view AS SELECT title FROM pages`)
}

test('views are exposed as read-only REST endpoints', async t => {
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
  app.register(sqlOpenAPI)
  t.after(() => app.close())

  await app.ready()

  // GET list should work for views
  {
    const res = await app.inject({
      method: 'GET',
      url: '/pagesView'
    })
    equal(res.statusCode, 200, 'GET /pagesView status code')
    const body = res.json()
    equal(body.length, 2, 'GET /pagesView returns all rows')
    equal(body[0].title, 'Hello')
    equal(body[1].title, 'World')
  }

  // GET list with where filter should work
  {
    const res = await app.inject({
      method: 'GET',
      url: '/pagesView?where.title.eq=Hello'
    })
    equal(res.statusCode, 200, 'GET /pagesView?where status code')
    const body = res.json()
    equal(body.length, 1)
    equal(body[0].title, 'Hello')
  }

  // POST should not exist for views
  {
    const res = await app.inject({
      method: 'POST',
      url: '/pagesView',
      body: {
        title: 'New'
      }
    })
    equal(res.statusCode, 404, 'POST /pagesView should return 404')
  }

  // PUT should not exist for views
  {
    const res = await app.inject({
      method: 'PUT',
      url: '/pagesView',
      body: {
        title: 'Updated'
      }
    })
    equal(res.statusCode, 404, 'PUT /pagesView should return 404')
  }

  // Verify the OpenAPI spec only has GET for the view
  {
    const res = await app.inject({
      method: 'GET',
      url: '/documentation/json'
    })
    const spec = res.json()
    const viewPaths = Object.keys(spec.paths).filter(p => p.startsWith('/pagesView'))
    equal(viewPaths.length, 1, 'Only one path for view')
    equal(viewPaths[0], '/pagesView/', 'Only GET list path exists')
    const methods = Object.keys(spec.paths['/pagesView/'])
    same(methods, ['get'], 'Only GET method for view')
  }
})

test('views and tables coexist', async t => {
  const app = fastify()
  app.register(sqlMapper, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      try { await db.query(sql`DROP VIEW IF EXISTS pages_view`) } catch {}
      await clear(db, sql)
      await createTablesAndViews(db, sql)
    }
  })
  app.register(sqlOpenAPI)
  t.after(() => app.close())

  await app.ready()

  // Table should have full CRUD
  {
    const res = await app.inject({
      method: 'POST',
      url: '/pages',
      body: { title: 'New Page' }
    })
    equal(res.statusCode, 200, 'POST /pages works')
  }

  // View should be read-only
  {
    const res = await app.inject({
      method: 'GET',
      url: '/pagesView'
    })
    equal(res.statusCode, 200, 'GET /pagesView works')
    const body = res.json()
    equal(body.length, 3, 'View reflects the newly inserted row')
  }
})
