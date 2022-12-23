'use strict'

const { test } = require('tap')
const sqlGraphQL = require('..')
const sqlMapper = require('@platformatic/sql-mapper')
const fastify = require('fastify')
const { clear, connInfo, isSQLite, isPg } = require('./helper')

test('should properly setup the enum types', { skip: isSQLite }, async ({ pass, teardown, same }) => {
  const app = fastify()
  app.register(sqlMapper, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      pass('onDatabaseLoad called')

      await clear(db, sql)

      if (isPg) {
        await db.query(sql`
        CREATE TYPE custom_enum AS ENUM('1', '2', '3');

        CREATE TABLE enum_tests (
          id INTEGER NOT NULL,
          test_enum custom_enum,
          PRIMARY KEY (id)
        );`)
      } else {
        await db.query(sql`
        CREATE TABLE enum_tests (
          id INTEGER NOT NULL,
          test_enum ENUM ('1', '2', '3') DEFAULT NULL,
          PRIMARY KEY (id)
        );`)
      }
    }
  })

  app.register(sqlGraphQL)
  teardown(app.close.bind(app))

  try {
    await app.ready()
    same(true, true, 'Enum values are properly interpreted')
  } catch (err) {
    console.log(err)
    same(true, false, 'Previous call should never fail')
  }
})

test('should not fail if tables have duplicate enum names', { skip: isSQLite }, async ({ pass, teardown, same }) => {
  const app = fastify()
  app.register(sqlMapper, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      pass('onDatabaseLoad called')

      await clear(db, sql)

      if (isPg) {
        await db.query(sql`
        CREATE TYPE custom_enum AS ENUM('1', '2', '3');
        CREATE TYPE simple_enum AS ENUM('4', '5', '6');
        
        CREATE TABLE enum_tests (
          id INTEGER NOT NULL,
          test_enum custom_enum,
          PRIMARY KEY (id)
        );
        CREATE TABLE simple_types (
          pk INTEGER NOT NULL,
          test_enum simple_enum,
          PRIMARY KEY (pk)
        );`)
      } else {
        await db.query(sql`
        CREATE TABLE enum_tests (
          id INTEGER NOT NULL,
          test_enum ENUM ('1', '2', '3') DEFAULT NULL,
          PRIMARY KEY (id)
        );
        CREATE TABLE simple_types (
          pk INTEGER NOT NULL,
          test_enum ENUM ('4', '5', '6') DEFAULT NULL,
          PRIMARY KEY (pk)
        );`)
      }
    }
  })

  app.register(sqlGraphQL)
  teardown(app.close.bind(app))

  try {
    await app.ready()
    same(true, true, 'test_enum is used twice but app not throws')
  } catch (err) {
    console.log(err)
    same(true, false, 'Previous call should never fail')
  }
})
