import sqlMapper from '@platformatic/sql-mapper'
import fastify from 'fastify'
import { equal, ok as pass, deepEqual as same } from 'node:assert'
import { test } from 'node:test'
import sqlGraphQL from '../index.js'
import { clear, connInfo, isSQLite } from './helper.js'

test('tables named after GraphQL root operation types do not crash', async t => {
  /* https://github.com/platformatic/platformatic/issues/1276 */
  const app = fastify()
  app.register(sqlMapper, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      pass('onDatabaseLoad called')

      await clear(db, sql)
      await db.query(sql`DROP TABLE IF EXISTS subscriptions`)
      await db.query(sql`DROP TABLE IF EXISTS queries`)

      if (isSQLite) {
        await db.query(sql`CREATE TABLE subscriptions (
          id INTEGER PRIMARY KEY,
          name VARCHAR(50) NOT NULL
        );`)
        await db.query(sql`CREATE TABLE queries (
          id INTEGER PRIMARY KEY,
          name VARCHAR(50) NOT NULL
        );`)
      } else {
        await db.query(sql`CREATE TABLE subscriptions (
          id SERIAL PRIMARY KEY,
          name VARCHAR(50) NOT NULL
        );`)
        await db.query(sql`CREATE TABLE queries (
          id SERIAL PRIMARY KEY,
          name VARCHAR(50) NOT NULL
        );`)
      }
    }
  })
  app.register(sqlGraphQL)
  t.after(async () => {
    const { db, sql } = app.platformatic
    await db.query(sql`DROP TABLE IF EXISTS subscriptions`)
    await db.query(sql`DROP TABLE IF EXISTS queries`)
    await app.close()
  })

  await app.ready()

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
          mutation {
            saveSubscription(input: { name: "premium" }) {
              id
              name
            }
          }
        `
      }
    })
    equal(res.statusCode, 200, 'saveSubscription status code')
    same(
      res.json(),
      {
        data: {
          saveSubscription: {
            id: '1',
            name: 'premium'
          }
        }
      },
      'saveSubscription response'
    )
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
          query {
            subscriptions {
              id
              name
            }
          }
        `
      }
    })
    equal(res.statusCode, 200, 'subscriptions query status code')
    same(
      res.json(),
      {
        data: {
          subscriptions: [
            {
              id: '1',
              name: 'premium'
            }
          ]
        }
      },
      'subscriptions query response'
    )
  }

  // The entity object type has been renamed to avoid the collision
  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
          query {
            __type(name: "SubscriptionEntity") {
              name
              kind
            }
          }
        `
      }
    })
    equal(res.statusCode, 200, 'introspection status code')
    same(
      res.json(),
      {
        data: {
          __type: {
            name: 'SubscriptionEntity',
            kind: 'OBJECT'
          }
        }
      },
      'introspection response'
    )
  }
})
