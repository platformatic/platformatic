import core from '@platformatic/db-core'
import fastify from 'fastify'
import { deepEqual, equal, ok } from 'node:assert'
import { test } from 'node:test'
import auth from '../index.js'
import { clear, connInfo, isSQLite } from './helper.js'

async function createPagesAndCategories (db, sql) {
  if (isSQLite) {
    await db.query(sql`CREATE TABLE IF NOT EXISTS pages (
      id INTEGER PRIMARY KEY,
      title VARCHAR(42),
      user_id INTEGER
    );`)
    await db.query(sql`CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY,
      name VARCHAR(42)
    );`)
  } else {
    await db.query(sql`CREATE TABLE IF NOT EXISTS pages (
      id SERIAL PRIMARY KEY,
      title VARCHAR(42),
      user_id INTEGER
    );`)
    await db.query(sql`CREATE TABLE IF NOT EXISTS categories (
      id SERIAL PRIMARY KEY,
      name VARCHAR(42)
    );`)
  }
}

test("the '*' wildcard applies a rule to all the entities", async () => {
  const app = fastify()
  app.register(core, {
    ...connInfo,
    events: false,
    async onDatabaseLoad (db, sql) {
      ok('onDatabaseLoad called')

      await clear(db, sql)
      await db.query(sql`DROP TABLE IF EXISTS categories`)
      await createPagesAndCategories(db, sql)
    }
  })
  app.register(auth, {
    jwt: {
      secret: 'supersecret'
    },
    roleKey: 'X-PLATFORMATIC-ROLE',
    anonymousRole: 'anonymous',
    rules: [
      // More specific rules for a role must come before the wildcard one
      {
        role: 'user',
        entity: 'page',
        find: true,
        delete: false,
        save: true
      },
      {
        role: 'user',
        entities: ['*'],
        find: false,
        delete: false,
        save: false
      },
      {
        role: 'anonymous',
        entity: '*',
        find: false,
        delete: false,
        save: false
      }
    ]
  })
  test.after(() => {
    app.close()
  })

  await app.ready()

  const token = await app.jwt.sign({
    'X-PLATFORMATIC-USER-ID': 42,
    'X-PLATFORMATIC-ROLE': 'user'
  })

  // The specific rule for pages wins over the wildcard one
  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: {
        query: `
          mutation {
            savePage(input: { title: "Hello" }) {
              id
              title
            }
          }
        `
      }
    })
    equal(res.statusCode, 200, 'savePage status code')
    deepEqual(
      res.json(),
      {
        data: {
          savePage: {
            id: 1,
            title: 'Hello'
          }
        }
      },
      'savePage response'
    )
  }

  // The wildcard rule denies access to the other entities
  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: {
        query: `
          mutation {
            saveCategory(input: { name: "News" }) {
              id
              name
            }
          }
        `
      }
    })
    equal(res.statusCode, 200, 'saveCategory status code')
    deepEqual(res.json().data.saveCategory, null, 'saveCategory is denied')
    equal(res.json().errors[0].message, 'operation not allowed', 'saveCategory error message')
  }

  // The anonymous wildcard rule denies access to every entity
  for (const url of ['/pages', '/categories']) {
    const res = await app.inject({
      method: 'GET',
      url
    })
    equal(res.statusCode, 403, `GET ${url} status code (anonymous)`)
  }
})

test('an unknown entity in a rule still fails', async () => {
  const app = fastify()
  app.register(core, {
    ...connInfo,
    events: false,
    async onDatabaseLoad (db, sql) {
      ok('onDatabaseLoad called')

      await clear(db, sql)
      await db.query(sql`DROP TABLE IF EXISTS categories`)
      await createPagesAndCategories(db, sql)
    }
  })
  app.register(auth, {
    roleKey: 'X-PLATFORMATIC-ROLE',
    anonymousRole: 'anonymous',
    rules: [
      {
        role: 'anonymous',
        entities: ['*', 'missing'],
        find: false,
        delete: false,
        save: false
      }
    ]
  })
  test.after(() => {
    app.close()
  })

  let error
  try {
    await app.ready()
  } catch (err) {
    error = err
  }
  equal(error.message.includes("Unknown entity 'missing'"), true, 'unknown entity error')
})
