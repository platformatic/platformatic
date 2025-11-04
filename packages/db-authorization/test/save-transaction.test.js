import core from '@platformatic/db-core'
import fastify from 'fastify'
import { equal, ok } from 'node:assert'
import { test } from 'node:test'
import auth from '../index.js'
import { clear, connInfo, createBasicPages } from './helper.js'

test('save with primary keys passes tx to authorization check', async (t) => {
  const app = fastify()

  app.register(core, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      await clear(db, sql)
      await createBasicPages(db, sql)
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
        entity: 'page',
        find: {
          checks: {
            userId: 'X-PLATFORMATIC-USER-ID'
          }
        },
        save: {
          checks: {
            userId: 'X-PLATFORMATIC-USER-ID'
          }
        },
        defaults: {
          userId: 'X-PLATFORMATIC-USER-ID'
        }
      }
    ]
  })

  // Test: Create and update within a transaction using entity methods directly.
  // When updating an existing record, save() calls find() internally to verify
  // the user has permission to modify that record. For this authorization check
  // to work correctly within a transaction, find() must receive the transaction
  // context to see uncommitted data from earlier operations in the same transaction.
  app.post('/test-transaction', async (_request, reply) => {
    return await app.platformatic.db.tx(async (tx) => {
      // Create a page within the transaction
      const created = await app.platformatic.entities.page.save({
        input: { title: 'Test Page' },
        ctx: { reply },
        tx
      })

      // Update the same page within the transaction
      // The authorization check must find this page to verify userId matches
      // This find() call needs tx to see the uncommitted insert above
      const updated = await app.platformatic.entities.page.save({
        input: {
          id: created.id,
          title: 'Updated Page'
        },
        ctx: { reply },
        tx
      })

      return { created, updated }
    })
  })

  t.after(() => {
    app.close()
  })

  await app.ready()

  const token = await app.jwt.sign({
    'X-PLATFORMATIC-USER-ID': 42,
    'X-PLATFORMATIC-ROLE': 'user'
  })

  const res = await app.inject({
    method: 'POST',
    url: '/test-transaction',
    headers: {
      Authorization: `Bearer ${token}`
    }
  })

  equal(res.statusCode, 200, 'should succeed')
  const json = res.json()
  ok(json.created, 'should have created')
  ok(json.updated, 'should have updated')
  equal(json.created.title, 'Test Page')
  equal(json.updated.title, 'Updated Page')
})
