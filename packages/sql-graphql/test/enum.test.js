'use strict'

const { clear, connInfo, isSQLite, isPg } = require('./helper')
const { test } = require('tap')
const sqlGraphQL = require('..')
const sqlMapper = require('@platformatic/sql-mapper')
const fastify = require('fastify')

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

test('should not fail if enum value contains a space ', { skip: isSQLite }, async ({ pass, teardown, same }) => {
  const app = fastify()
  app.register(sqlMapper, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      pass('onDatabaseLoad called')

      await clear(db, sql)

      if (isPg) {
        await db.query(sql`
        CREATE TYPE custom_enum AS ENUM('Field 1', 'Field .', '. Field', ' f 1 ');

        CREATE TABLE enum_tests (
          id INTEGER NOT NULL,
          test_enum custom_enum,
          PRIMARY KEY (id)
        );`)
      } else {
        await db.query(sql`
        CREATE TABLE enum_tests (
          id INTEGER NOT NULL,
          test_enum ENUM ('Field 1', 'Field .', '. Field', ' f 1 ') DEFAULT NULL,
          PRIMARY KEY (id)
        );`)
      }
    }
  })

  app.register(sqlGraphQL)
  teardown(app.close.bind(app))

  try {
    await app.ready()
    same(true, true, 'Enum with spaces are properly interpreted')
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

test('should not fail if tables have enum with special characters', { skip: isSQLite }, async ({ pass, teardown, same, equal }) => {
  const app = fastify()
  app.register(sqlMapper, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      pass('onDatabaseLoad called')

      await clear(db, sql)

      if (isPg) {
        await db.query(sql`
          CREATE TYPE custom_enum AS ENUM('.', ',');

          CREATE TABLE enum_tests (
            id INTEGER NOT NULL,
            test_enum custom_enum,
            PRIMARY KEY (id)
          );
        `)
      } else {
        await db.query(sql`
          CREATE TABLE enum_tests (
            id INTEGER NOT NULL,
            test_enum ENUM ('.', ',') DEFAULT NULL,
            PRIMARY KEY (id)
          );
        `)
      }
    }
  })

  app.register(sqlGraphQL)
  teardown(app.close.bind(app))

  try {
    await app.ready()
    same(true, true, 'custom_enum have special chars, but app does not throws')
  } catch (err) {
    console.log(err)
    same(true, false, 'Previous call should never fail')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
            mutation ($input: EnumTestInput!) {
              saveEnumTest(input: $input) {
                id
              }
            }
          `,
        variables: { input: { id: 1 } }
      }
    })
    equal(res.statusCode, 200)
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
            mutation ($input: EnumTestInput!) {
              saveEnumTest(input: $input) {
                id
              }
            }
          `,
        variables: { input: { id: 2 } }
      }
    })
    equal(res.statusCode, 200)
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
            query { enumTests { id } }
          `
      }
    })
    equal(res.statusCode, 200)
    same(res.json(), { data: { enumTests: [{ id: 1 }, { id: 2 }] } })
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
            mutation ($input: EnumTestWhereArgumentsid!) {
              deleteEnumTests(where: {id: $input}) {
                id
              }
            }
          `,
        variables: { input: { eq: 1 } }
      }
    })
    equal(res.statusCode, 200)
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
            query { enumTests { id } }
          `
      }
    })
    equal(res.statusCode, 200)
    same(res.json(), { data: { enumTests: [{ id: 2 }] } })
  }
})
