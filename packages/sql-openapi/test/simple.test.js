'use strict'

const t = require('tap')
const sqlOpenAPI = require('..')
const sqlMapper = require('@platformatic/sql-mapper')
const fastify = require('fastify')
const { clear, connInfo, isSQLite, isMariaDB } = require('./helper')
const { resolve } = require('path')
const { test } = t

Object.defineProperty(t, 'fullname', {
  value: 'platformatic/db/openapi/simple'
})

async function createBasicPages (db, sql) {
  if (isSQLite) {
    await db.query(sql`CREATE TABLE pages (
      id INTEGER PRIMARY KEY,
      title VARCHAR(42) NOT NULL
    );`)
  } else {
    await db.query(sql`CREATE TABLE pages (
      id SERIAL PRIMARY KEY,
      title VARCHAR(42) NOT NULL
    );`)
  }
}

test('simple db, simple rest API', async (t) => {
  const { pass, teardown, same, equal, matchSnapshot } = t
  t.snapshotFile = resolve(__dirname, 'tap-snapshots', 'simple-openapi-1.cjs')

  const app = fastify()
  app.register(sqlMapper, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      pass('onDatabaseLoad called')

      await clear(db, sql)
      await createBasicPages(db, sql)
    }
  })
  app.register(sqlOpenAPI)
  teardown(app.close.bind(app))

  await app.ready()

  {
    const res = await app.inject({
      method: 'POST',
      url: '/pages',
      body: {
        title: 'Hello'
      }
    })
    equal(res.statusCode, 200, 'POST /pages status code')
    equal(res.headers.location, '/pages/1', 'POST /api/pages location')
    same(res.json(), {
      id: 1,
      title: 'Hello'
    }, 'POST /pages response')
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: '/pages/1'
    })
    equal(res.statusCode, 200, 'GET /pages/1 status code')
    same(res.json(), {
      id: 1,
      title: 'Hello'
    }, 'GET /pages/1 response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/pages/1',
      body: {
        title: 'Hello World'
      }
    })
    equal(res.statusCode, 200, 'POST /pages/1 status code')
    same(res.json(), {
      id: 1,
      title: 'Hello World'
    }, 'POST /pages/1 response')
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: '/pages/1'
    })
    equal(res.statusCode, 200, 'GET /pages/1 status code')
    same(res.json(), {
      id: 1,
      title: 'Hello World'
    }, 'GET /pages/1 response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/pages',
      body: {
        tilte: 'Hello' // typo, wrong field
      }
    })
    equal(res.statusCode, 400, 'POST /pages status code')
    equal(res.headers.location, undefined, 'no location header')
    same(res.json(), {
      statusCode: 400,
      error: 'Bad Request',
      message: "body must have required property 'title'"
    }, 'POST /pages response')
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: '/documentation/json'
    })
    const json = res.json()
    matchSnapshot(json, 'GET /documentation/json response')
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: '/pages/1?fields=title'
    })
    same(res.json(), {
      title: 'Hello World'
    }, 'GET /pages/1?fields=title response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/pages/1?fields=title',
      body: {
        title: 'Hello fields'
      }
    })
    same(res.json(), {
      title: 'Hello fields'
    }, 'POST /pages/1?fields=title response')
  }

  {
    // Fields as array
    const res = await app.inject({
      method: 'GET',
      url: '/pages/1?fields=title&fields=id'
    })
    same(res.json(), {
      id: 1,
      title: 'Hello fields'
    }, 'GET /pages/1?fields=title&fields=id response')
  }

  {
    // Fields as comma separated strings
    const res = await app.inject({
      method: 'GET',
      url: '/pages/1?fields=title,id'
    })
    same(res.json(), {
      id: 1,
      title: 'Hello fields'
    }, 'GET /pages/1?fields=title,id response')
  }
})

async function createBasicPagesNullable (db, sql) {
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

test('nullable fields', async (t) => {
  const { pass, teardown, same, equal, matchSnapshot } = t
  t.snapshotFile = resolve(__dirname, 'tap-snapshots', 'simple-openapi-2.cjs')

  const app = fastify()
  app.register(sqlMapper, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      pass('onDatabaseLoad called')

      await clear(db, sql)
      await createBasicPagesNullable(db, sql)
    }
  })
  app.register(sqlOpenAPI)
  teardown(app.close.bind(app))

  await app.ready()
  {
    const res = await app.inject({
      method: 'POST',
      url: '/pages',
      body: {
        // empty object
      }
    })
    equal(res.statusCode, 200, 'POST /pages status code')
    equal(res.headers.location, '/pages/1', 'POST /api/pages location')
    same(res.json(), {
      id: 1,
      title: null
    }, 'POST /pages response')
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: '/documentation/json'
    })
    const openapi = res.json()
    matchSnapshot(openapi, 'GET /documentation/json response')
  }
})

test('list', async ({ pass, teardown, same, equal }) => {
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
          long_text TEXT
        );`)
      } else {
        await db.query(sql`CREATE TABLE posts (
          id SERIAL PRIMARY KEY,
          title VARCHAR(42),
          long_text TEXT
        );`)
      }
    }
  })
  app.register(sqlOpenAPI)
  teardown(app.close.bind(app))

  await app.ready()

  const posts = [{
    title: 'Post 1',
    longText: 'This is a long text 1'
  }, {
    title: 'Post 2',
    longText: 'This is a long text 2'
  }, {
    title: 'Post 3',
    longText: 'This is a long text 3'
  }, {
    title: 'Post 4',
    longText: 'This is a long text 4'
  }]

  for (const body of posts) {
    await app.inject({
      method: 'POST',
      url: '/posts',
      body
    })
  }

  {
    const url = '/posts'
    const res = await app.inject({ method: 'GET', url })
    equal(res.statusCode, 200, `${url} status code`)
    equal(res.headers['x-total-count'], undefined, `${url} without x-total-count`)
    same(res.json(), posts.map((p, i) => {
      return { ...p, id: i + 1 + '' }
    }), `${url} response`)
  }

  {
    const url = '/posts?limit=3'
    const res = await app.inject({ method: 'GET', url })
    equal(res.statusCode, 200, `${url} status code`)
    equal(res.headers['x-total-count'], undefined, `${url} without x-total-count`)
    same(res.json(), posts.map((p, i) => {
      return { ...p, id: i + 1 + '' }
    }).slice(0, 3), `${url} response`)
  }

  {
    const url = '/posts?offset=2'
    const res = await app.inject({ method: 'GET', url })
    equal(res.statusCode, 200, `${url} status code`)
    equal(res.headers['x-total-count'], undefined, `${url} without x-total-count`)
    same(res.json(), posts.map((p, i) => {
      return { ...p, id: i + 1 + '' }
    }).slice(2), `${url} response`)
  }

  {
    const url = '/posts?limit=2&offset=1'
    const res = await app.inject({ method: 'GET', url })
    equal(res.statusCode, 200, `${url} status code`)
    equal(res.headers['x-total-count'], undefined, `${url} without x-total-count`)
    same(res.json(), posts.map((p, i) => {
      return { ...p, id: i + 1 + '' }
    }).slice(1, 3), `${url} response`)
  }

  {
    const url = '/posts?totalCount=true'
    const res = await app.inject({ method: 'GET', url })
    equal(res.statusCode, 200, `${url} status code`)
    equal(res.headers['x-total-count'], posts.length, `${url} with x-total-count`)
  }

  {
    const url = '/posts?totalCount=true&limit=3'
    const res = await app.inject({ method: 'GET', url })
    equal(res.statusCode, 200, `${url} status code`)
    equal(res.headers['x-total-count'], posts.length, `${url} with x-total-count`)
    same(res.json(), posts.map((p, i) => {
      return { ...p, id: i + 1 + '' }
    }).slice(0, 3), `${url} response`)
  }

  {
    const url = '/posts?totalCount=true&offset=2'
    const res = await app.inject({ method: 'GET', url })
    equal(res.statusCode, 200, `${url} status code`)
    equal(res.headers['x-total-count'], posts.length, `${url} with x-total-count`)
    same(res.json(), posts.map((p, i) => {
      return { ...p, id: i + 1 + '' }
    }).slice(2), `${url} response`)
  }

  {
    const url = '/posts?totalCount=true&limit=2&offset=1'
    const res = await app.inject({ method: 'GET', url })
    equal(res.statusCode, 200, `${url} status code`)
    equal(res.headers['x-total-count'], posts.length, `${url} with x-total-count`)
    same(res.json(), posts.map((p, i) => {
      return { ...p, id: i + 1 + '' }
    }).slice(1, 3), `${url} response`)
  }

  {
    const url = '/posts?totalCount=true&limit=2&offset=99'
    const res = await app.inject({ method: 'GET', url })
    equal(res.statusCode, 200, `${url} status code`)
    equal(res.headers['x-total-count'], posts.length, `${url} with x-total-count`)
    same(res.json(), [], `${url} response`)
  }

  {
    const url = '/posts?totalCount=true&limit=99&offset=0'
    const res = await app.inject({ method: 'GET', url })
    equal(res.statusCode, 200, `${url} status code`)
    equal(res.headers['x-total-count'], posts.length, `${url} with x-total-count`)
    same(res.json(), posts.map((p, i) => {
      return { ...p, id: i + 1 + '' }
    }).slice(0, 4), `${url} response`)
  }

  {
    const url = '/posts?totalCount=true&limit=99&offset=2'
    const res = await app.inject({ method: 'GET', url })
    equal(res.statusCode, 200, `${url} status code`)
    equal(res.headers['x-total-count'], posts.length, `${url} with x-total-count`)
    same(res.json(), posts.map((p, i) => {
      return { ...p, id: i + 1 + '' }
    }).slice(2, 4), `${url} response`)
  }
})

test('not found', async ({ pass, teardown, same, equal }) => {
  const app = fastify()
  app.register(sqlMapper, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      pass('onDatabaseLoad called')

      await clear(db, sql)

      await createBasicPages(db, sql)
    }
  })
  app.register(sqlOpenAPI)
  teardown(app.close.bind(app))

  await app.ready()

  {
    const res = await app.inject({
      method: 'GET',
      url: '/pages/1'
    })
    equal(res.statusCode, 404, 'GET /pages/1 status code')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/pages/1',
      body: {
        title: 'Hello World'
      }
    })
    equal(res.statusCode, 404, 'POST /pages/1 status code')
  }

  {
    const res = await app.inject({
      method: 'DELETE',
      url: '/pages/1'
    })
    equal(res.statusCode, 404, 'DELETE /pages/1 status code')
  }
})

test('delete', async ({ pass, teardown, same, equal }) => {
  const app = fastify()
  app.register(sqlMapper, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      pass('onDatabaseLoad called')

      await clear(db, sql)

      await createBasicPages(db, sql)
    }
  })
  app.register(sqlOpenAPI)
  teardown(app.close.bind(app))

  await app.ready()

  {
    const res = await app.inject({
      method: 'GET',
      url: '/pages/1'
    })
    equal(res.statusCode, 404, 'GET /pages/1 status code')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/pages',
      body: {
        title: 'Hello'
      }
    })
    equal(res.statusCode, 200, 'POST /pages status code')
    equal(res.headers.location, '/pages/1', 'POST /api/pages location')
    same(res.json(), {
      id: 1,
      title: 'Hello'
    }, 'POST /pages response')
  }

  {
    const res = await app.inject({
      method: 'DELETE',
      url: '/pages/1'
    })
    equal(res.statusCode, 200, 'DELETE /pages/1 status code')
    same(res.json(), {
      id: 1,
      title: 'Hello'
    }, 'DELETE /pages response')
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: '/pages/1'
    })
    equal(res.statusCode, 404, 'GET /pages/1 status code')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/pages',
      body: {
        title: 'Hello fields'
      }
    })
    const { id } = res.json()

    const res2 = await app.inject({
      method: 'DELETE',
      url: `/pages/${id}?fields=title`
    })
    same(res2.json(), {
      title: 'Hello fields'
    }, 'DELETE /pages?fields=title response')
  }
})

test('simple db, simple rest API', async (t) => {
  const { pass, teardown, matchSnapshot } = t
  t.snapshotFile = resolve(__dirname, 'tap-snapshots', 'simple-openapi-3.cjs')

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
    info: {
      title: 'Simple Title',
      description: 'Simple Description',
      version: '42.42.42'
    }
  })
  teardown(app.close.bind(app))

  await app.ready()

  const res = await app.inject({
    method: 'GET',
    url: '/documentation/json'
  })
  const json = res.json()
  matchSnapshot(json, 'GET /documentation/json response')
})

test('deserialize JSON columns', { skip: isSQLite }, async (t) => {
  const { pass, teardown, same } = t
  const app = fastify()
  const jsonData = {
    foo: 'bar',
    baz: 42,
    items: ['foo', 'bar'],
    nested: {
      hello: 'world'
    }
  }
  app.register(sqlMapper, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      pass('onDatabaseLoad called')

      await clear(db, sql)

      await db.query(sql`CREATE TABLE pages (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        metadata JSON NOT NULL
      );`)

      await db.query(sql`INSERT INTO pages (id, title, metadata) VALUES (1, 'Hello World', ${JSON.stringify(jsonData)})`)
    }
  })
  app.register(sqlOpenAPI)
  teardown(app.close.bind(app))

  await app.ready()

  const res = await app.inject({
    method: 'GET',
    url: '/pages'
  })
  const json = res.json()
  if (isMariaDB) {
    same(json[0].metadata, JSON.stringify(jsonData))
  } else {
    same(json[0].metadata, jsonData)
  }
})

test('expose the api with a prefix, if defined', async (t) => {
  const { pass, teardown, same, equal } = t

  const app = fastify()
  app.register(sqlMapper, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      pass('onDatabaseLoad called')

      await clear(db, sql)
      await createBasicPages(db, sql)
    }
  })
  app.register(sqlOpenAPI, { prefix: '/api' })
  teardown(app.close.bind(app))

  await app.ready()
  {
    const res = await app.inject({
      method: 'POST',
      url: '/pages',
      body: {
        title: 'Hello'
      }
    })
    equal(res.statusCode, 404, 'POST /pages status code')
    same(res.json(), {
      message: 'Route POST:/pages not found',
      error: 'Not Found',
      statusCode: 404
    }, 'POST /pages response')
  }
  {
    const res = await app.inject({
      method: 'POST',
      url: '/api/pages',
      body: {
        title: 'Hello'
      }
    })
    equal(res.statusCode, 200, 'POST /pages status code')
    equal(res.headers.location, '/api/pages/1', 'POST /api/pages location')
    same(res.json(), {
      id: 1,
      title: 'Hello'
    }, 'POST /pages response')
  }
})
