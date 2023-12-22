'use strict'

const { clear, connInfo, isSQLite, isMysql8, isMysql } = require('./helper')
const t = require('tap')
const sqlOpenAPI = require('..')
const sqlMapper = require('@platformatic/sql-mapper')
const fastify = require('fastify')
const { test } = t

Object.defineProperty(t, 'fullname', {
  value: 'platformatic/db/openapi/simple'
})

async function createBasicPages (db, sql) {
  await db.query(sql`CREATE SCHEMA IF NOT EXISTS test1;`)
  if (isMysql || isMysql8) {
    await db.query(sql`CREATE TABLE IF NOT EXISTS \`test1\`.\`pages\` (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL
    );`)
  } else {
    await db.query(sql`CREATE TABLE IF NOT EXISTS "test1"."pages" (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL
    );`)
  }

  await db.query(sql`CREATE SCHEMA IF NOT EXISTS test2;`)

  if (isMysql || isMysql8) {
    await db.query(sql`CREATE TABLE IF NOT EXISTS \`test2\`.\`users\` (
      id SERIAL PRIMARY KEY,
      username VARCHAR(255) NOT NULL,
      page_id BIGINT UNSIGNED,
      FOREIGN KEY(page_id) REFERENCES test1.pages(id) ON DELETE CASCADE
    );`)
  } else {
    await db.query(sql`CREATE TABLE IF NOT EXISTS "test2"."users" (
      id SERIAL PRIMARY KEY,
      username VARCHAR(255) NOT NULL,
      page_id integer REFERENCES test1.pages(id)
    );`)
  }
}

test('Simple rest API with different schemas', { skip: isSQLite }, async (t) => {
  const { pass, teardown, same, equal } = t

  const app = fastify()
  app.register(sqlMapper, {
    ...connInfo,
    schema: ['test1', 'test2'],
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
      url: '/documentation/json'
    })
    equal(res.json().info.version, '1.0.0', 'GET /documentation/json info version default')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/test1Pages',
      body: {
        title: 'Hello'
      }
    })
    equal(res.statusCode, 200, 'POST /test1Pages status code')
    equal(res.headers.location, '/test1Pages/1', 'POST /api/pages location')
    same(res.json(), {
      id: 1,
      title: 'Hello'
    }, 'POST /test1Pages response')
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: '/test1Pages/1'
    })
    equal(res.statusCode, 200, 'GET /test1Pages/1 status code')
    same(res.json(), {
      id: 1,
      title: 'Hello'
    }, 'GET /test1Pages/1 response')
  }

  {
    const res = await app.inject({
      method: 'PUT',
      url: '/test1Pages/1',
      body: {
        title: 'Hello World'
      }
    })
    equal(res.statusCode, 200, 'PUT /test1Pages/1 status code')
    same(res.json(), {
      id: 1,
      title: 'Hello World'
    }, 'POST /test1Pages/1 response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/test2Users',
      body: {
        username: 'user1',
        pageId: 1
      }
    })
    equal(res.statusCode, 200, 'POST /test2Users status code')
    same(res.json(), {
      id: 1,
      username: 'user1',
      pageId: 1
    }, 'POST /test2Users response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/test2Users',
      body: {
        username: 'user2',
        pageId: 1
      }
    })
    equal(res.statusCode, 200, 'POST /test2Users status code')
    same(res.json(), {
      id: 2,
      username: 'user2',
      pageId: 1
    }, 'POST /test2Users response')
  }

  // nested queries
  {
    const res = await app.inject({
      method: 'GET',
      url: '/test1Pages/1/test2Users'
    })
    equal(res.statusCode, 200, 'GET /test1Pages/1/test2Users status code')
    same(res.json(), [
      {
        id: 1,
        username: 'user1',
        pageId: 1
      }, {
        id: 2,
        username: 'user2',
        pageId: 1
      }
    ], 'GET /test1Pages/1 response')
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: 'test2Users/2/page'
    })
    equal(res.statusCode, 200, 'GET /test2Users/2/page status code')
    same(res.json(),
      {
        id: 1,
        title: 'Hello World'
      }
      , 'GET /test2Users/2/page response')
  }
})

test('composite primary keys with schema', { skip: isSQLite }, async ({ equal, same, teardown, rejects }) => {
  async function onDatabaseLoad (db, sql) {
    await clear(db, sql)

    await db.query(sql`CREATE SCHEMA IF NOT EXISTS test1;`)
    await db.query(sql`CREATE SCHEMA IF NOT EXISTS test2;`)

    if (isMysql || isMysql8) {
      await db.query(sql`CREATE TABLE test1.pages (
        id INTEGER PRIMARY KEY AUTO_INCREMENT,
        the_title VARCHAR(255) NOT NULL
      );`)

      await db.query(sql`CREATE TABLE test2.users (
        id INTEGER PRIMARY KEY AUTO_INCREMENT,
        username VARCHAR(255) NOT NULL
      );`)

      await db.query(sql`CREATE TABLE test1.editors (
        page_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        role VARCHAR(255) NOT NULL,
        CONSTRAINT \`fk_editor_pages\` FOREIGN KEY (page_id) REFERENCES test1.pages (id) ON DELETE CASCADE ON UPDATE RESTRICT,
        CONSTRAINT \`fk_editor_users\` FOREIGN KEY (user_id) REFERENCES test2.users (id) ON DELETE CASCADE ON UPDATE RESTRICT,
        PRIMARY KEY (page_id, user_id)
      );`)
    } else {
      await db.query(sql`CREATE TABLE test1.pages (
        id SERIAL PRIMARY KEY,
        the_title VARCHAR(255) NOT NULL
      );`)

      await db.query(sql`CREATE TABLE test2.users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) NOT NULL
      );`)

      await db.query(sql`CREATE TABLE test1.editors (
        page_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        role VARCHAR(255) NOT NULL,
        CONSTRAINT fk_editor_pages FOREIGN KEY (page_id) REFERENCES test1.pages(id),
        CONSTRAINT fk_editor_users FOREIGN KEY (user_id) REFERENCES test2.users(id),
        PRIMARY KEY (page_id, user_id)
      );`)
    }
  }

  const app = fastify()
  app.register(sqlMapper, {
    ...connInfo,
    schema: ['test1', 'test2'],
    onDatabaseLoad
  })
  app.register(sqlOpenAPI)
  teardown(app.close.bind(app))

  await app.ready()

  {
    const res = await app.inject({
      method: 'POST',
      url: '/test1Pages',
      body: {
        theTitle: 'foobar'
      }
    })
    equal(res.statusCode, 200, 'POST /test1Pages status code')
    same(res.json(), {
      id: 1,
      theTitle: 'foobar'
    }, 'POST /test1Pages response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/test2Users',
      body: {
        username: 'mcollina'
      }
    })
    equal(res.statusCode, 200, 'POST /test2Users status code')
    same(res.json(), {
      id: 1,
      username: 'mcollina'
    }, 'POST /test2users response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/test2Users',
      body: {
        username: 'lucamaraschi'
      }
    })
    equal(res.statusCode, 200, 'POST /test2Users status code')
    same(res.json(), {
      id: 2,
      username: 'lucamaraschi'
    }, 'POST /test2Users response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/test1Editors/test1Page/1/test2User/1',
      body: {
        role: 'admin'
      }
    })
    equal(res.statusCode, 200, 'POST /test1Editors/test1Page/1/test2User/1 status code')
    same(res.json(), {
      userId: 1,
      pageId: 1,
      role: 'admin'
    }, 'POST /test1Editors/test1Page/1/test2User/1 response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/test1Editors/test1Page/1/test2User/2',
      body: {
        role: 'author'
      }
    })
    equal(res.statusCode, 200, 'POST /editors/page/1/user/2 status code')
    same(res.json(), {
      userId: 2,
      pageId: 1,
      role: 'author'
    }, 'POST /test1Editors/test1page/1/test2User/2 response')
    equal(res.headers.location, '/test1Editors/test1Page/1/test2User/2', 'POST /test1Editors/test1Page/1/test2User/2 location header')
  }
})
