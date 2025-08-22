import sqlMapper from '@platformatic/sql-mapper'
import fastify from 'fastify'
import { equal, ok as pass, deepEqual as same } from 'node:assert'
import { test } from 'node:test'
import sqlGraphQL from '../index.js'
import { clear, connInfo, isSQLite } from './helper.js'

test('count', async t => {
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
          long_text TEXT,
          counter INTEGER
        );`)
      } else {
        await db.query(sql`CREATE TABLE posts (
          id SERIAL PRIMARY KEY,
          title VARCHAR(42),
          long_text TEXT,
          counter INTEGER
        );`)
      }
    }
  })
  app.register(sqlGraphQL)
  t.after(() => app.close())

  await app.ready()

  const posts = [
    {
      title: 'Dog',
      longText: 'Foo',
      counter: 10
    },
    {
      title: 'Cat',
      longText: 'Bar',
      counter: 20
    },
    {
      title: 'Mouse',
      longText: 'Baz',
      counter: 30
    },
    {
      title: 'Duck',
      longText: 'A duck tale',
      counter: 40
    }
  ]

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
            mutation batch($inputs : [PostInput]!) {
              insertPosts(inputs: $inputs) {
                id
                title
              }
            }
          `,
        variables: {
          inputs: posts
        }
      }
    })
    equal(res.statusCode, 200, 'posts status code')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
          query {
            countPosts {
              total
            }
          }
        `
      }
    })
    equal(res.statusCode, 200, 'posts status code')
    same(
      res.json(),
      {
        data: {
          countPosts: {
            total: 4
          }
        }
      },
      'posts response'
    )
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
          query {
            countPosts(where: { counter: { gt: 20 } }) {
              total
            }
          }
        `
      }
    })
    equal(res.statusCode, 200, 'posts status code')
    same(
      res.json(),
      {
        data: {
          countPosts: {
            total: 2
          }
        }
      },
      'posts response'
    )
  }
})
