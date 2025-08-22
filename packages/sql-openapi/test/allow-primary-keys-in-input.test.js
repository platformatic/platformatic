import Snap from '@matteo.collina/snap'
import sqlMapper from '@platformatic/sql-mapper'
import fastify from 'fastify'
import { equal, ok as pass, deepEqual as same } from 'node:assert'
import { test } from 'node:test'
import sqlOpenAPI from '../index.js'
import { clear, connInfo, isMysql, isSQLite } from './helper.js'

async function createBasicPages (db, sql) {
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
}

const snap = Snap(import.meta.filename)

test('allowPrimaryKeysInInput: false', async t => {
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
    allowPrimaryKeysInInput: false
  })
  t.after(() => app.close())

  await app.ready()

  {
    const res = await app.inject({
      method: 'GET',
      url: '/documentation/json'
    })
    const json = res.json()
    const snapshot = await snap(json)
    same(json, snapshot)
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/pages',
      body: {
        id: 42,
        title: 'Hello'
      }
    })
    equal(res.statusCode, 400, 'POST /pages status code')
    same(
      res.json(),
      {
        statusCode: 400,
        code: 'FST_ERR_VALIDATION',
        error: 'Bad Request',
        message: 'body/id must NOT be valid'
      },
      'POST /pages response'
    )
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
    same(
      res.json(),
      {
        id: 1, // The passed in id is ignored
        title: 'Hello'
      },
      'POST /pages response'
    )
  }
})

test('allowPrimaryKeysInInput: true', async t => {
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
    allowPrimaryKeysInInput: true
  })
  t.after(() => app.close())

  await app.ready()

  {
    const res = await app.inject({
      method: 'GET',
      url: '/documentation/json'
    })
    const json = res.json()
    const snapshot = await snap(json)
    same(json, snapshot)
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/pages',
      body: {
        id: 42,
        title: 'Hello'
      }
    })
    equal(res.statusCode, 200, 'POST /pages status code')
    equal(res.headers.location, '/pages/42', 'POST /api/pages location')
    same(
      res.json(),
      {
        id: 42, // The passed in id is used
        title: 'Hello'
      },
      'POST /pages response'
    )
  }
})

test('allowPrimaryKeysInInput default', async t => {
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
  t.after(() => app.close())

  await app.ready()

  {
    const res = await app.inject({
      method: 'GET',
      url: '/documentation/json'
    })
    const json = res.json()
    const snapshot = await snap(json)
    same(json, snapshot)
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/pages',
      body: {
        id: 42,
        title: 'Hello'
      }
    })
    equal(res.statusCode, 200, 'POST /pages status code')
    equal(res.headers.location, '/pages/42', 'POST /api/pages location')
    same(
      res.json(),
      {
        id: 42, // The passed in id is used
        title: 'Hello'
      },
      'POST /pages response'
    )
  }
})
