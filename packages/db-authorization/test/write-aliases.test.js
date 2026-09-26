import core from '@platformatic/db-core'
import fastify from 'fastify'
import { deepEqual, equal } from 'node:assert'
import { test } from 'node:test'
import auth from '../index.js'
import { clear, connInfo, isSQLite } from './helper.js'

async function setup (t) {
  const app = fastify()
  app.register(core, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      await clear(db, sql)
      if (isSQLite) {
        await db.query(sql`DROP TABLE IF EXISTS owned_pages`)
        await db.query(sql`DROP TABLE IF EXISTS assignments`)
      } else {
        await db.query(sql`DROP TABLE IF EXISTS owned_pages CASCADE`)
        await db.query(sql`DROP TABLE IF EXISTS assignments CASCADE`)
      }

      if (isSQLite) {
        await db.query(sql`CREATE TABLE owned_pages (
          page_id INTEGER PRIMARY KEY,
          title VARCHAR(42),
          user_id INTEGER
        )`)
      } else {
        await db.query(sql`CREATE TABLE owned_pages (
          page_id SERIAL PRIMARY KEY,
          title VARCHAR(42),
          user_id INTEGER
        )`)
      }

      await db.query(sql`CREATE TABLE assignments (
        page_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        owner_id INTEGER NOT NULL,
        title VARCHAR(42),
        PRIMARY KEY (page_id, user_id)
      )`)
    }
  })
  app.register(auth, {
    jwt: { secret: 'supersecret' },
    roleKey: 'X-PLATFORMATIC-ROLE',
    anonymousRole: 'anonymous',
    rules: [
      {
        role: 'user',
        entity: 'ownedPage',
        find: true,
        delete: false,
        defaults: { userId: 'X-PLATFORMATIC-USER-ID' },
        save: { checks: { userId: 'X-PLATFORMATIC-USER-ID' } }
      },
      {
        role: 'user',
        entity: 'assignment',
        find: true,
        delete: false,
        defaults: { ownerId: 'X-PLATFORMATIC-USER-ID' },
        save: { checks: { ownerId: 'X-PLATFORMATIC-USER-ID' } }
      },
      { role: 'anonymous', entity: '*', find: false, delete: false, save: false }
    ]
  })

  app.post('/write/:entity/:operation', async (request, reply) => {
    const values = request.params.operation === 'insertMany'
      ? { inputs: request.body }
      : { input: request.body }
    return app.platformatic.entities[request.params.entity][request.params.operation]({
      ...values,
      ctx: { reply }
    })
  })

  t.after(() => app.close())
  await app.ready()

  const tokenFor = userId => app.jwt.sign({
    'X-PLATFORMATIC-USER-ID': userId,
    'X-PLATFORMATIC-ROLE': 'user'
  })

  const write = (entity, operation, token, body) => app.inject({
    method: 'POST',
    url: `/write/${entity}/${operation}`,
    headers: { authorization: `Bearer ${token}` },
    body
  })

  return { app, tokenFor, write }
}

test('write authorization normalizes field aliases before checks and execution', async t => {
  const { app, tokenFor, write } = await setup(t)
  const ownerToken = await tokenFor(42)
  const otherToken = await tokenFor(43)

  // user_id appears after userId, which previously allowed it to override the
  // authorization default when the mapper normalized the input.
  const created = await write('ownedPage', 'insert', ownerToken, {
    pageId: 1,
    userId: 999,
    user_id: 999,
    title: 'mine'
  })
  equal(created.statusCode, 200)
  deepEqual(created.json(), { pageId: 1, title: 'mine', userId: 42 })

  const other = await write('ownedPage', 'insert', otherToken, {
    pageId: 2,
    title: 'other'
  })
  equal(other.statusCode, 200)

  const insertedMany = await write('ownedPage', 'insertMany', ownerToken, [{
    pageId: 3,
    userId: 999,
    user_id: 999,
    title: 'many'
  }])
  equal(insertedMany.statusCode, 200)
  deepEqual(insertedMany.json(), [{ pageId: 3, title: 'many', userId: 42 }])

  const rawPrimaryKey = await write('ownedPage', 'update', otherToken, {
    page_id: 1,
    title: 'hacked with raw key'
  })
  equal(rawPrimaryKey.statusCode, 403)

  const missingPrimaryKey = await app.inject({
    method: 'POST',
    url: '/write/ownedPage/update',
    body: { title: 'missing key' }
  })
  equal(missingPrimaryKey.statusCode, 403)

  // Authorization and mapper execution must resolve conflicting aliases to the
  // same value. The last alias targets page 2, which user 42 does not own.
  const conflictingPrimaryKey = await write('ownedPage', 'update', ownerToken, {
    pageId: 1,
    page_id: 2,
    title: 'hacked with conflicting keys'
  })
  equal(conflictingPrimaryKey.statusCode, 403)

  // Preserve the existing authorization behavior: a complete missing key is
  // not distinguishable from an inaccessible row, so upsert must not insert.
  const missingUpsert = await write('ownedPage', 'upsert', ownerToken, {
    pageId: 99,
    title: 'must not be inserted'
  })
  equal(missingUpsert.statusCode, 403)

  const pages = await app.platformatic.entities.ownedPage.find({ orderBy: [{ field: 'pageId', direction: 'asc' }] })
  deepEqual(pages, [
    { pageId: 1, title: 'mine', userId: 42 },
    { pageId: 2, title: 'other', userId: 43 },
    { pageId: 3, title: 'many', userId: 42 }
  ])
})

test('write authorization uses normalized mixed aliases for composite primary keys', async t => {
  const { app, tokenFor, write } = await setup(t)
  const entity = app.platformatic.entities.assignment
  await entity.insert({ input: { pageId: 1, userId: 1, ownerId: 42, title: 'mine' } })
  await entity.insert({ input: { pageId: 2, userId: 1, ownerId: 43, title: 'other' } })

  const ownerToken = await tokenFor(42)
  const response = await write('assignment', 'update', ownerToken, {
    pageId: 1,
    userId: 1,
    page_id: 2,
    title: 'hacked'
  })
  equal(response.statusCode, 403)

  deepEqual(await entity.find({ orderBy: [{ field: 'pageId', direction: 'asc' }] }), [
    { pageId: 1, userId: 1, ownerId: 42, title: 'mine' },
    { pageId: 2, userId: 1, ownerId: 43, title: 'other' }
  ])
})
