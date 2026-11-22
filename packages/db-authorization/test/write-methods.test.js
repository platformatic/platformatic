import sqlMapper from '@platformatic/sql-mapper'
import fastify from 'fastify'
import { deepEqual, equal } from 'node:assert'
import { test } from 'node:test'
import auth from '../index.js'
import { clear, connInfo, createBasicPages } from './helper.js'

async function setup (t, rule, createTables = createBasicPages) {
  const app = fastify()
  const entityName = rule.entity || 'page'
  t.after(() => app.close())

  app.register(sqlMapper, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      await clear(db, sql)
      await createTables(db, sql)
    }
  })
  app.register(auth, {
    jwt: { secret: 'supersecret' },
    rules: [{ role: 'anonymous', entity: entityName, ...rule }]
  })

  app.post('/write/:operation', async (request, reply) => {
    return app.platformatic.entities[entityName][request.params.operation]({
      input: request.body.input,
      fields: request.body.fields,
      ctx: { reply },
      skipAuth: false
    })
  })

  await app.ready()
  return app
}

async function setupUserPreferences (t, rule = {}) {
  return setup(t, {
    role: 'user',
    entity: 'userPreference',
    defaults: { userId: 'X-PLATFORMATIC-USER-ID' },
    find: { checks: { userId: 'X-PLATFORMATIC-USER-ID' } },
    save: { checks: { userId: 'X-PLATFORMATIC-USER-ID' } },
    ...rule
  }, async (db, sql) => {
    await db.query(sql`DROP TABLE IF EXISTS user_preferences`)
    await db.query(sql`CREATE TABLE user_preferences (
      user_id INTEGER PRIMARY KEY,
      theme VARCHAR(20)
    )`)
  })
}

function authHeaders (app, userId) {
  const token = app.jwt.sign({
    'X-PLATFORMATIC-ROLE': 'user',
    'X-PLATFORMATIC-USER-ID': userId
  })
  return { authorization: `Bearer ${token}` }
}

test('write authorization rejects falsy inputs without inserting rows', async t => {
  for (const operation of ['insert', 'upsert', 'save']) {
    for (const input of [false, 0, '']) {
      await t.test(`${operation} with input ${JSON.stringify(input)}`, async t => {
        const app = await setup(t, {
          find: false,
          save: false,
          delete: false
        })

        // Wrap the input so the custom endpoint receives each falsy value unchanged.
        const response = await app.inject({
          method: 'POST',
          url: `/write/${operation}`,
          body: { input }
        })

        deepEqual(await app.platformatic.entities.page.find(), [], 'denied writes must not insert rows')
        equal(response.statusCode, 403, response.body)
        equal(response.json().code, 'PLT_DB_AUTH_UNAUTHORIZED')
      })
    }
  }
})

test('upserts update user preferences using the primary key from JWT metadata', async t => {
  for (const operation of ['upsert', 'save']) {
    await t.test(operation, async t => {
      const app = await setupUserPreferences(t)
      const entity = app.platformatic.entities.userPreference
      // Each user's preferences were created during signup.
      await entity.insert({ input: { userId: 42, theme: 'light' } })
      await entity.insert({ input: { userId: 43, theme: 'light' } })

      const expected = [
        { userId: '42', theme: 'light' },
        { userId: '43', theme: 'light' }
      ]
      for (const [index, theme] of ['dark', 'system'].entries()) {
        const userId = Number(expected[index].userId)
        const response = await app.inject({
          method: 'POST',
          url: `/write/${operation}`,
          headers: authHeaders(app, userId),
          // The primary key comes from the JWT, not the request body.
          body: { input: { theme } }
        })

        equal(response.statusCode, 200, response.body)
        expected[index].theme = theme
        deepEqual(response.json(), expected[index])
        deepEqual(await entity.find({ orderBy: [{ field: 'userId', direction: 'asc' }] }), expected)
      }
    })
  }
})

test('upserts apply authorization defaults once when inserting rows', async t => {
  for (const operation of ['upsert', 'save']) {
    await t.test(operation, async t => {
      const defaultUserId = t.mock.fn(({ user }) => user['X-PLATFORMATIC-USER-ID'])
      const app = await setup(t, {
        role: 'user',
        find: true,
        save: true,
        defaults: { userId: defaultUserId }
      })

      const response = await app.inject({
        method: 'POST',
        url: `/write/${operation}`,
        headers: authHeaders(app, 42),
        body: { input: { title: 'new page' } }
      })

      equal(response.statusCode, 200, response.body)
      const expected = { id: response.json().id, title: 'new page', userId: 42 }
      deepEqual(response.json(), expected)
      deepEqual(await app.platformatic.entities.page.find(), [expected])
      equal(defaultUserId.mock.callCount(), 1)
    })
  }
})

test('upserts default the preferences primary key even when clients can only write the theme', async t => {
  for (const operation of ['upsert', 'save']) {
    await t.test(operation, async t => {
      const defaultUserId = t.mock.fn(({ user }) => user['X-PLATFORMATIC-USER-ID'])
      const app = await setupUserPreferences(t, {
        save: { fields: ['theme'], checks: { userId: 'X-PLATFORMATIC-USER-ID' } },
        defaults: { userId: defaultUserId }
      })
      const entity = app.platformatic.entities.userPreference
      await entity.insert({ input: { userId: 42, theme: 'light' } })

      const response = await app.inject({
        method: 'POST',
        url: `/write/${operation}`,
        headers: authHeaders(app, 42),
        body: { input: { theme: 'dark' }, fields: ['theme'] }
      })

      equal(response.statusCode, 200, response.body)
      deepEqual(response.json(), { theme: 'dark' })
      deepEqual(await entity.find(), [{ userId: '42', theme: 'dark' }])
      equal(defaultUserId.mock.callCount(), 1, 'authorization defaults must run once per write')
    })
  }
})

test('upserts reject missing preferences without modifying another user\'s row', async t => {
  for (const operation of ['upsert', 'save']) {
    for (const input of [{ theme: 'dark' }, { userId: 42, theme: 'dark' }]) {
      await t.test(`${operation} with ${input.userId ? 'another user\'s ID' : 'no user ID'}`, async t => {
        const app = await setupUserPreferences(t)
        const entity = app.platformatic.entities.userPreference
        const original = { userId: '42', theme: 'light' }
        await entity.insert({ input: original })

        // User 43 has no preferences row. Their JWT must determine the target,
        // including when they try to supply user 42's primary key in the body.
        const response = await app.inject({
          method: 'POST',
          url: `/write/${operation}`,
          headers: authHeaders(app, 43),
          body: { input }
        })

        equal(response.statusCode, 403, response.body)
        equal(response.json().code, 'PLT_DB_AUTH_UNAUTHORIZED')
        deepEqual(await entity.find(), [original])
      })
    }
  }
})
