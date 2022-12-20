'use strict'

const { test } = require('tap')
const sqlGraphQL = require('..')
const sqlMapper = require('@platformatic/sql-mapper')
const fastify = require('fastify')
const { clear, connInfo, isSQLite, isPg } = require('./helper')

test('should correctly get the special characters', { skip: isSQLite }, async ({ pass, teardown, same }) => {
  const app = fastify()
  app.register(sqlMapper, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      pass('onDatabaseLoad called')

      await clear(db, sql)

      if (isPg) {
        await db.query(sql`
        CREATE TYPE custom_enum AS ENUM ('application/pdf', 'image/jpeg', 'image/png');
        CREATE TABLE enum_tests (
          id INTEGER NOT NULL,
          test_enum custom_enum,
          PRIMARY KEY (id)
        );`)
      } else {
        await db.query(sql`
        CREATE TABLE enum_tests (
          id INTEGER NOT NULL,
          test_enum ENUM ('application/pdf', 'image/jpeg', 'image/png'),
          PRIMARY KEY (id)
        );`)
      }
    }
  })

  app.register(sqlGraphQL)
  teardown(app.close.bind(app))

  try {
    await app.ready()
    same(true, true, 'Special characters are properly configured')
  } catch (err) {
    console.log(err)
    same(true, false, 'Previous call should never fail')
  }
})
