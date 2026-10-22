import core from '@platformatic/db-core'
import fastify from 'fastify'
import { deepEqual, equal } from 'node:assert'
import { test } from 'node:test'
import auth from '../index.js'
import { connInfo, isSQLite } from './helper.js'

async function createAssets (db, sql) {
  await db.query(sql`DROP TABLE IF EXISTS assets`)
  if (isSQLite) {
    await db.query(sql`CREATE TABLE assets (
      asset_id INTEGER PRIMARY KEY,
      title VARCHAR(42),
      user_id INTEGER
    );`)
  } else {
    await db.query(sql`CREATE TABLE assets (
      asset_id SERIAL PRIMARY KEY,
      title VARCHAR(42),
      user_id INTEGER
    );`)
  }
  await db.query(sql`INSERT INTO assets (asset_id, title, user_id) VALUES (1, 'Hello World', 42);`)
}

async function createVersionedPages (db, sql) {
  await db.query(sql`DROP TABLE IF EXISTS versioned_pages`)
  // version_id needs a default so that an input carrying only part of the key is
  // a legal insert, which is what distinguishes a partial key from a full one.
  await db.query(sql`CREATE TABLE versioned_pages (
    id INTEGER NOT NULL,
    version_id INTEGER NOT NULL DEFAULT 1,
    title VARCHAR(42),
    user_id INTEGER,
    PRIMARY KEY (id, version_id)
  );`)
  await db.query(sql`INSERT INTO versioned_pages (id, version_id, title, user_id) VALUES (1, 7, 'Hello World', 42);`)
}

function buildApp (createTables, entity) {
  const app = fastify()
  app.register(core, {
    ...connInfo,
    events: false,
    async onDatabaseLoad (db, sql) {
      await createTables(db, sql)
    }
  })
  app.register(auth, {
    jwt: {
      secret: 'supersecret'
    },
    roleKey: 'X-PLATFORMATIC-ROLE',
    anonymousRole: 'anonymous',
    rules: [
      {
        role: 'user',
        entity,
        find: true,
        delete: false,
        save: {
          checks: {
            userId: 'X-PLATFORMATIC-USER-ID'
          }
        }
      }
    ]
  })
  return app
}

function signIn (app, userId) {
  return app.jwt.sign({
    'X-PLATFORMATIC-USER-ID': userId,
    'X-PLATFORMATIC-ROLE': 'user'
  })
}

function graphql (app, token, query) {
  return app.inject({
    method: 'POST',
    url: '/graphql',
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: { query }
  })
}

function notAllowed (path) {
  return {
    data: {
      [path]: null
    },
    errors: [
      {
        message: 'operation not allowed',
        locations: [
          {
            line: 3,
            column: 9
          }
        ],
        path: [path]
      }
    ]
  }
}

test('a single primary key whose column differs from its field name is checked on save', async () => {
  const app = buildApp(createAssets, 'asset')
  test.after(() => app.close())
  await app.ready()

  const res = await graphql(
    app,
    await signIn(app, 43),
    `
      mutation {
        saveAsset(input: { assetId: 1, title: "Taken over" }) {
          assetId
          title
        }
      }
    `
  )

  equal(res.statusCode, 200, 'saveAsset status code')
  deepEqual(res.json(), notAllowed('saveAsset'), 'saveAsset response')
})

test('the owner can still save a row keyed by such a primary key', async () => {
  const app = buildApp(createAssets, 'asset')
  test.after(() => app.close())
  await app.ready()

  const res = await graphql(
    app,
    await signIn(app, 42),
    `
      mutation {
        saveAsset(input: { assetId: 1, title: "Hello Again" }) {
          assetId
          title
        }
      }
    `
  )

  equal(res.statusCode, 200, 'saveAsset status code')
  deepEqual(
    res.json(),
    {
      data: {
        saveAsset: {
          assetId: '1',
          title: 'Hello Again'
        }
      }
    },
    'saveAsset response'
  )
})

test('a composite primary key is checked on save when the input carries all of it', async () => {
  const app = buildApp(createVersionedPages, 'versionedPage')
  test.after(() => app.close())
  await app.ready()

  const res = await graphql(
    app,
    await signIn(app, 43),
    `
      mutation {
        saveVersionedPage(input: { id: 1, versionId: 7, title: "Taken over" }) {
          id
          title
        }
      }
    `
  )

  equal(res.statusCode, 200, 'saveVersionedPage status code')
  deepEqual(res.json(), notAllowed('saveVersionedPage'), 'saveVersionedPage response')
})

// SQLite's insertOne nulls a missing primary key column to reach autoincrement,
// so a partial composite key cannot insert there whatever authorization decides.
test('a partial composite primary key is an insert, not a guarded update', { skip: isSQLite }, async () => {
  const app = buildApp(createVersionedPages, 'versionedPage')
  test.after(() => app.close())
  await app.ready()

  const res = await graphql(
    app,
    await signIn(app, 43),
    `
      mutation {
        saveVersionedPage(input: { id: 2, title: "Brand new" }) {
          id
          versionId
          title
        }
      }
    `
  )

  equal(res.statusCode, 200, 'saveVersionedPage status code')
  deepEqual(
    res.json(),
    {
      data: {
        saveVersionedPage: {
          id: 2,
          versionId: 1,
          title: 'Brand new'
        }
      }
    },
    'saveVersionedPage response'
  )
})
