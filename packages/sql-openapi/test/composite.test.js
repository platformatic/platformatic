'use strict'

const { clear, connInfo, isSQLite, isMysql, isPg } = require('./helper')
const { test } = require('tap')
const fastify = require('fastify')
const sqlMapper = require('@platformatic/sql-mapper')
const sqlOpenAPI = require('..')

test('composite primary keys', async ({ equal, same, teardown, rejects }) => {
  /* https://github.com/platformatic/platformatic/issues/299 */
  async function onDatabaseLoad (db, sql) {
    await clear(db, sql)

    if (isSQLite) {
      await db.query(sql`CREATE TABLE pages (
        id INTEGER PRIMARY KEY,
        the_title VARCHAR(42)
      );`)

      await db.query(sql`CREATE TABLE users (
        id INTEGER PRIMARY KEY,
        username VARCHAR(255) NOT NULL
      );`)

      await db.query(sql`CREATE TABLE editors (
        page_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        role VARCHAR(255) NOT NULL,
        CONSTRAINT fk_editor_pages FOREIGN KEY (page_id) REFERENCES pages(id),
        CONSTRAINT fk_editor_users FOREIGN KEY (user_id) REFERENCES users(id),
        PRIMARY KEY (page_id, user_id)
      );`)
    } else if (isPg) {
      await db.query(sql`CREATE TABLE pages (
        id SERIAL PRIMARY KEY,
        the_title VARCHAR(255) NOT NULL
      );`)

      await db.query(sql`CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) NOT NULL
      );`)

      await db.query(sql`CREATE TABLE editors (
        page_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        role VARCHAR(255) NOT NULL,
        CONSTRAINT fk_editor_pages FOREIGN KEY (page_id) REFERENCES pages(id),
        CONSTRAINT fk_editor_users FOREIGN KEY (user_id) REFERENCES users(id),
        PRIMARY KEY (page_id, user_id)
      );`)
    } else if (isMysql) {
      await db.query(sql`CREATE TABLE pages (
        id INTEGER PRIMARY KEY AUTO_INCREMENT,
        the_title VARCHAR(255) NOT NULL
      );`)

      await db.query(sql`CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTO_INCREMENT,
        username VARCHAR(255) NOT NULL
      );`)

      await db.query(sql`CREATE TABLE editors (
        page_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        role VARCHAR(255) NOT NULL,
        CONSTRAINT \`fk_editor_pages\` FOREIGN KEY (page_id) REFERENCES pages (id) ON DELETE CASCADE ON UPDATE RESTRICT,
        CONSTRAINT \`fk_editor_users\` FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE RESTRICT,
        PRIMARY KEY (page_id, user_id)
      );`)
    }
  }

  const app = fastify()
  app.register(sqlMapper, {
    ...connInfo,
    onDatabaseLoad
  })
  app.register(sqlOpenAPI)
  teardown(app.close.bind(app))

  await app.ready()

  {
    const res = await app.inject({
      method: 'POST',
      url: '/pages',
      body: {
        theTitle: 'foobar'
      }
    })
    equal(res.statusCode, 200, 'POST /pages status code')
    same(res.json(), {
      id: 1,
      theTitle: 'foobar'
    }, 'POST /pages response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/users',
      body: {
        username: 'mcollina'
      }
    })
    equal(res.statusCode, 200, 'POST /users status code')
    same(res.json(), {
      id: 1,
      username: 'mcollina'
    }, 'POST /users response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/users',
      body: {
        username: 'lucamaraschi'
      }
    })
    equal(res.statusCode, 200, 'POST /users status code')
    same(res.json(), {
      id: 2,
      username: 'lucamaraschi'
    }, 'POST /users response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/editors/page/1/user/1',
      body: {
        role: 'admin'
      }
    })
    equal(res.statusCode, 200, 'POST /editors/page/1/user/1 status code')
    same(res.json(), {
      userId: 1,
      pageId: 1,
      role: 'admin'
    }, 'POST /editors/page/1/user/1 response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/editors/page/1/user/2',
      body: {
        role: 'author'
      }
    })
    equal(res.statusCode, 200, 'POST /editors/page/1/user/2 status code')
    same(res.json(), {
      userId: 2,
      pageId: 1,
      role: 'author'
    }, 'POST /editors/page/1/user/2 response')
    equal(res.headers.location, '/editors/page/1/user/2', 'POST /editors/page/1/user/2 location header')
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: '/editors/page/1/user/2'
    })
    equal(res.statusCode, 200, 'GET /editors/page/1/user/2 status code')
    same(res.json(), {
      userId: 2,
      pageId: 1,
      role: 'author'
    }, 'GET /editors/page/1/user/2 response')
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: '/editors/page/1/user/3'
    })
    equal(res.statusCode, 404, 'GET /editors/page/1/user/3 status code')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/editors/page/1/user/1',
      body: {
        role: 'captain'
      }
    })
    equal(res.statusCode, 200, 'POST /editors/page/1/user/1 status code')
    same(res.json(), {
      userId: 1,
      pageId: 1,
      role: 'captain'
    }, 'POST /editors/page/1/user/1 response')
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: '/editors?orderby.role=desc'
    })
    equal(res.statusCode, 200, 'GET /editors status code')
    same(res.json(), [{
      userId: '1',
      pageId: '1',
      role: 'captain'
    }, {
      userId: '2',
      pageId: '1',
      role: 'author'
    }], 'GET /editors response')
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: '/editors?where.role.eq=author'
    })
    equal(res.statusCode, 200, 'GET /editors status code')
    same(res.json(), [{
      userId: '2',
      pageId: '1',
      role: 'author'
    }], 'GET /editors response')
  }

  {
    const res = await app.inject({
      method: 'DELETE',
      url: '/editors/page/1/user/2'
    })
    equal(res.statusCode, 200, 'DELETE /editors/page/1/user/2 status code')
    same(res.json(), {
      userId: 2,
      pageId: 1,
      role: 'author'
    }, 'DELETE /editors/page/1/user/2 response')
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: '/editors/page/1/user/2'
    })
    equal(res.statusCode, 404, 'GET /editors/page/1/user/2 status code')
  }

  {
    const res = await app.inject({
      method: 'DELETE',
      url: '/editors/page/1/user/2'
    })
    equal(res.statusCode, 404, 'DELETE /editors/page/1/user/2 status code')
  }
})
