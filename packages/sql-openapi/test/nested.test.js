
'use strict'

const t = require('tap')
const fastify = require('fastify')
const sqlOpenAPI = require('..')
const sqlMapper = require('@platformatic/sql-mapper')
const { clear, connInfo, isSQLite, isMysql } = require('./helper')
const { resolve } = require('path')
const { test } = t

Object.defineProperty(t, 'fullname', {
  value: 'platformatic/db/openapi/where'
})

test('nested routes', async (t) => {
  const { pass, teardown, same, equal, matchSnapshot } = t
  t.snapshotFile = resolve(__dirname, 'tap-snapshots', 'nested-routes-openapi.cjs')
  const app = fastify()
  app.register(sqlMapper, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      pass('onDatabaseLoad called')

      await clear(db, sql)

      if (isMysql) {
        await db.query(sql`
          CREATE TABLE owners (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255)
          );
          CREATE TABLE posts (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            title VARCHAR(42),
            long_text TEXT,
            counter INTEGER,
            owner_id INT UNSIGNED,
            FOREIGN KEY (owner_id) REFERENCES owners(id) ON DELETE CASCADE
          );
        `)
      } else if (isSQLite) {
        await db.query(sql`
          CREATE TABLE owners (
            id INTEGER PRIMARY KEY,
            name VARCHAR(255)
          );
        `)

        await db.query(sql`
          CREATE TABLE posts (
            id INTEGER PRIMARY KEY,
            title VARCHAR(42),
            long_text TEXT,
            counter INTEGER,
            owner_id BIGINT UNSIGNED,
            FOREIGN KEY (owner_id) REFERENCES owners(id) ON DELETE CASCADE
          );
        `)
      } else {
        await db.query(sql`
        CREATE TABLE owners (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255)
        );
        CREATE TABLE posts (
          id SERIAL PRIMARY KEY,
          title VARCHAR(42),
          long_text TEXT,
          counter INTEGER,
          owner_id INTEGER REFERENCES owners(id)
        );`)
      }
    }
  })
  app.register(sqlOpenAPI)
  teardown(app.close.bind(app))

  await app.ready()

  {
    const res = await app.inject({
      method: 'GET',
      url: '/documentation/json'
    })
    const openapi = res.json()
    matchSnapshot(openapi, 'matches expected OpenAPI defs')
  }

  const owners = [{
    name: 'Matteo'
  }, {
    name: 'Luca'
  }, {
    name: 'Marco'
  }]

  const posts = [{
    title: 'Dog',
    longText: 'Foo',
    counter: 10
  }, {
    title: 'Cat',
    longText: 'Bar',
    counter: 20
  }, {
    title: 'Mouse',
    longText: 'Baz',
    counter: 30
  }, {
    title: 'Duck',
    longText: 'A duck tale',
    counter: 40
  }, {
    title: 'Horse',
    longText: 'A horse tale',
    counter: 50
  }]

  const ownerIds = []
  for (const body of owners) {
    const res = await app.inject({
      method: 'POST',
      url: '/owners',
      body
    })
    equal(res.statusCode, 200, 'POST /owners status code')
    ownerIds.push(res.json().id)
  }

  // Marco has no posts on purpose
  posts[0].ownerId = ownerIds[0]
  posts[1].ownerId = ownerIds[0]
  posts[2].ownerId = ownerIds[1]
  posts[3].ownerId = ownerIds[1]
  posts[4].ownerId = null

  for (const body of posts) {
    const res = await app.inject({
      method: 'POST',
      url: '/posts',
      body
    })
    equal(res.statusCode, 200, 'POST /posts status code')
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: `/owners/${ownerIds[0]}/posts?fields=title,longText,counter,ownerId`
    })
    equal(res.statusCode, 200, 'GET /owners/:id/posts status code')
    same(res.json(), [posts[0], posts[1]], 'GET /owners/:id/posts response')
  }

  {
    // Owner exists, but has no posts
    const res = await app.inject({
      method: 'GET',
      url: '/owners/3/posts'
    })
    equal(res.statusCode, 200, 'GET /owners/:id/posts status code')
    same(res.json(), [], 'GET /owners/:id/posts response')
  }

  {
    // Owner does not exist
    const res = await app.inject({
      method: 'GET',
      url: '/owners/42/posts'
    })
    equal(res.statusCode, 404, 'GET /posts status code')
    same(res.json(), {
      message: 'Route GET:/owners/42/posts not found',
      error: 'Not Found',
      statusCode: 404
    }, 'GET /owners/:id/posts response')
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: '/posts/3/owner'
    })
    equal(res.statusCode, 200, 'GET /posts/:id/owner status code')
    same(res.json().name, owners[1].name, 'GET /posts/:id/owner response')
  }

  {
    // Post does not exist
    const res = await app.inject({
      method: 'GET',
      url: '/posts/42/owner'
    })
    equal(res.statusCode, 404, 'GET /posts/:id/owner status code')
    same(res.json(), {
      message: 'Route GET:/posts/42/owner not found',
      error: 'Not Found',
      statusCode: 404
    }, 'GET /posts/:id/owner response')
  }

  {
    // Post exists, owner does not
    const res = await app.inject({
      method: 'GET',
      url: '/posts/5/owner'
    })
    equal(res.statusCode, 404, 'GET /posts/:id/owner status code')
    same(res.json(), {
      message: 'Route GET:/posts/5/owner not found',
      error: 'Not Found',
      statusCode: 404
    }, 'GET /posts/:id/owner response')
  }
})

test('nested routes with recursive FK', async (t) => {
  const { pass, teardown, same, equal, matchSnapshot } = t
  t.snapshotFile = resolve(__dirname, 'tap-snapshots', 'nested-routes-openapi-recursive.cjs')
  const app = fastify()
  app.register(sqlMapper, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      pass('onDatabaseLoad called')

      await clear(db, sql)

      if (isMysql) {
        await db.query(sql`
          CREATE TABLE people (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            parent_id INT UNSIGNED,
            FOREIGN KEY (parent_id) REFERENCES people(id)
          );
        `)
      } else if (isSQLite) {
        await db.query(sql`
          CREATE TABLE people (
            id INTEGER PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            parent_id INTEGER UNSIGNED,
            FOREIGN KEY (parent_id) REFERENCES people(id)
          );
        `)
      } else {
        await db.query(sql`
          CREATE TABLE people (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            parent_id INTEGER REFERENCES people(id)
          );
        `)
      }
    }
  })
  app.register(sqlOpenAPI)
  teardown(app.close.bind(app))

  await app.ready()

  {
    const res = await app.inject({
      method: 'GET',
      url: '/documentation/json'
    })
    const openapi = res.json()
    matchSnapshot(openapi, 'matches expected OpenAPI defs')
  }

  const res = await app.inject({
    method: 'POST',
    url: '/people',
    body: {
      name: 'Dad'
    }
  })
  equal(res.statusCode, 200, 'POST /people status code')
  const dad = res.json()

  const res2 = await app.inject({
    method: 'POST',
    url: '/people',
    body: {
      name: 'Child',
      parentId: dad.id
    }
  })
  equal(res.statusCode, 200, 'POST /people status code')
  const child = res2.json()

  {
    const res = await app.inject({
      method: 'GET',
      url: '/people'
    })
    equal(res.statusCode, 200, 'GET /people status code')
    same(res.json(), [{
      id: 1,
      name: 'Dad',
      parentId: null
    }, {
      id: 2,
      name: 'Child',
      parentId: 1
    }], 'GET /people response')
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: `/people/${child.id}/parent`
    })
    equal(res.statusCode, 200, 'GET /people/:id/parent status code')
    same(res.json(), {
      id: 1,
      name: 'Dad',
      parentId: null
    }, 'GET /people/:id/parent response')
  }
})
