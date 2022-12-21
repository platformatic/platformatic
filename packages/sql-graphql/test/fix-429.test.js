'use strict'

const { test } = require('tap')
const sqlGraphQL = require('..')
const sqlMapper = require('@platformatic/sql-mapper')
const fastify = require('fastify')
const { connInfo, clear, isSQLite } = require('./helper')
const { randomUUID } = require('crypto')

test('saveEntity should have all inputs fields as nullable', { skip: isSQLite }, async ({ pass, teardown, same, equal }) => {
  const app = fastify()
  app.register(sqlMapper, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      pass('onDatabaseLoad called')
      await clear(db, sql)

      await db.query(sql`
create table pages (
  id varchar(100) not null primary key,
  name varchar(60) not null constraint "uq_company_name" unique,
  brand_color varchar(10),
  created_at timestamp,
  updated_at timestamp
);
`)
    }
  })
  await app.register(sqlGraphQL)
  teardown(app.close.bind(app))

  await app.ready()

  const id = randomUUID()

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
          mutation {
            savePage(input: { id: "${id}", name: "Platformatic", brandColor: "#000000" }) {
              id
              name,
              brandColor
            }
          }
        `
      }
    })
    equal(res.statusCode, 200, 'savePage status code')
    same(res.json(), {
      data: {
        savePage: {
          id,
          name: 'Platformatic',
          brandColor: '#000000'
        }
      }
    }, 'savePage response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
          mutation {
            savePage(input: { id: "${id}", brandColor: "green" }) {
              id
              name
              brandColor
            }
          }
        `
      }
    })
    equal(res.statusCode, 200, 'savePage status code')
    same(res.json(), {
      data: {
        savePage: {
          id,
          name: 'Platformatic',
          brandColor: 'green'
        }
      }
    }, 'savePage response')
  }
})
