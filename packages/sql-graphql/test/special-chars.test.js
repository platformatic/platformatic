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
        CREATE TYPE special_chars AS ENUM('application/pdf', 'image/jpeg', 'image/png');
        CREATE TABLE enum_tests (
          "id" uuid NOT NULL,
          "test_enum" special_chars,
          PRIMARY KEY ("id")
        );`)
      } else {
        await db.query(sql`
        CREATE TABLE enum_tests (
          "id" uuid NOT NULL,
          "test_enum" enum('application/pdf', 'image/jpeg', 'image/png') DEFAULT NULL,
          PRIMARY KEY ("id")
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
