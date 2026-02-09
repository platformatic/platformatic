import sqlMapper from '@platformatic/sql-mapper'
import fastify from 'fastify'
import { ok as pass, deepEqual as same } from 'node:assert'
import { test } from 'node:test'
import sqlGraphQL from '../index.js'
import { clear, connInfo, isPg, isSQLite } from './helper.js'

test('should correctly get the special characters', { skip: isSQLite }, async t => {
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
    same(true, false, 'Previous call should never fail')
  }
})
