'use strict'

const { clear, connInfo, isSQLite, isPg } = require('./helper')
const { test } = require('node:test')
const { deepEqual: same, ok: pass } = require('node:assert')
const sqlGraphQL = require('..')
const sqlMapper = require('@platformatic/sql-mapper')
const fastify = require('fastify')

test('should correctly get the special characters', { skip: isSQLite }, async (t) => {
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
  t.after(() => app.close())

  try {
    await app.ready()
    same(true, true, 'Special characters are properly configured')
  } catch (err) {
    console.log(err)
    same(true, false, 'Previous call should never fail')
  }
})
