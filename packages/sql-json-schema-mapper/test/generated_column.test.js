'use strict'

const t = require('tap')
const sqlMapper = require('@platformatic/sql-mapper')
const fastify = require('fastify')
const { clear, connInfo, isSQLite, isPg } = require('./helper')
const { mapSQLEntityToJSONSchema } = require('..')
const { test } = t

async function createBasicPages (db, sql) {
  if (isSQLite) {
    await db.query(sql`CREATE TABLE generated_test (
      id INTEGER PRIMARY KEY,
      test INTEGER,
      test_stored INTEGER GENERATED ALWAYS AS (test*2) STORED,
      test_virtual INTEGER GENERATED ALWAYS AS (test*4) VIRTUAL
    );`)
  } else if (isPg) {
    await db.query(sql`CREATE TABLE generated_test (
      id SERIAL PRIMARY KEY,
      test INTEGER,
      test_stored INTEGER GENERATED ALWAYS AS (test*2) STORED
    );`)
  } else {
    await db.query(sql`CREATE TABLE generated_test (
      id INTEGER UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      test INTEGER,
      test_stored INTEGER GENERATED ALWAYS AS (test*2) STORED,
      test_virtual INTEGER GENERATED ALWAYS AS (test*4) VIRTUAL
    );`)
  }
}

test('stored and virtual generated columns should be read only', async (t) => {
  const { pass, teardown } = t

  const app = fastify()
  app.register(sqlMapper, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      pass('onDatabaseLoad called')

      await clear(db, sql)
      await createBasicPages(db, sql)
    }
  })
  teardown(app.close.bind(app))

  await app.ready()

  {
    const generatedTest = app.platformatic.entities.generatedTest
    const generatedTestJsonSchema = mapSQLEntityToJSONSchema(generatedTest)

    // as of postgresql 15 virtual generated column is not supported
    if (isPg) {
      t.same(generatedTestJsonSchema.properties.testStored, { type: 'integer', nullable: true, readOnly: true })
    } else {
      t.same(generatedTestJsonSchema.properties.testStored, { type: 'integer', nullable: true, readOnly: true })
      t.same(generatedTestJsonSchema.properties.testVirtual, { type: 'integer', nullable: true, readOnly: true })
    }
  }
})
