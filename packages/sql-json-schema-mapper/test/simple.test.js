'use strict'

const t = require('tap')
const sqlMapper = require('@platformatic/sql-mapper')
const fastify = require('fastify')
const { clear, connInfo, isSQLite, isMariaDB, isPg } = require('./helper')
const { mapSQLEntityToJSONSchema } = require('..')
const { test } = t

async function createBasicPages (db, sql) {
  if (isSQLite) {
    await db.query(sql`CREATE TABLE pages (
      id INTEGER PRIMARY KEY,
      title VARCHAR(42) NOT NULL,
      metadata JSON,
      section NUMERIC,
      description TEXT
    );`)
  } else if (isPg) {
    await db.query(sql`CREATE TYPE pagetype as enum ('blank', 'non-blank');
      CREATE TABLE pages (
      id SERIAL PRIMARY KEY,
      title VARCHAR(42) NOT NULL,
      metadata JSON,
      section NUMERIC,
      description TEXT,
      type pagetype
    );`)
  } else {
    await db.query(sql`CREATE TABLE pages (
      id INTEGER UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(42) NOT NULL,
      metadata JSON,
      section NUMERIC,
      description TEXT,
      type ENUM ('blank', 'non-blank')
    );`)
  }
}

async function createBasicGeneratedTests (db, sql) {
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
    await db.query(sql`INSERT INTO generated_test (test) VALUES(1);`)
  }
}

test('simple db, simple rest API', async (t) => {
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
    const page = app.platformatic.entities.page
    const pageJsonSchema = mapSQLEntityToJSONSchema(page)

    t.equal(pageJsonSchema.$id, 'Page')
    t.equal(pageJsonSchema.title, 'Page')
    t.equal(pageJsonSchema.description, 'A Page')
    t.equal(pageJsonSchema.type, 'object')
    t.same(pageJsonSchema.properties.id, { type: 'integer' })
    t.same(pageJsonSchema.properties.title, { type: 'string' })
    t.same(pageJsonSchema.properties.description, { type: 'string', nullable: true })
    t.same(pageJsonSchema.properties.section, { type: 'string', nullable: true })
    if (isMariaDB) {
      t.same(pageJsonSchema.properties.metadata, { type: 'string', nullable: true })
    } else {
      t.same(pageJsonSchema.properties.metadata, { type: 'object', additionalProperties: true, nullable: true })
    }
    t.same(pageJsonSchema.required, ['title'])
    if (!isSQLite) {
      t.same(pageJsonSchema.properties.type, { type: 'string', nullable: true, enum: ['blank', 'non-blank'] })
    }
  }
})

test('ignore one field', async (t) => {
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
    const page = app.platformatic.entities.page
    const pageJsonSchema = mapSQLEntityToJSONSchema(page, {
      title: true
    })

    t.equal(pageJsonSchema.$id, 'Page')
    t.equal(pageJsonSchema.title, 'Page')
    t.equal(pageJsonSchema.description, 'A Page')
    t.equal(pageJsonSchema.type, 'object')
    t.same(pageJsonSchema.properties.id, { type: 'integer' })
    t.equal(pageJsonSchema.properties.title, undefined)
    t.same(pageJsonSchema.properties.description, { type: 'string', nullable: true })
    if (isMariaDB) {
      t.same(pageJsonSchema.properties.metadata, { type: 'string', nullable: true })
    } else {
      t.same(pageJsonSchema.properties.metadata, { type: 'object', additionalProperties: true, nullable: true })
    }
    t.same(pageJsonSchema.required, [])
    if (!isSQLite) {
      t.same(pageJsonSchema.properties.type, { type: 'string', nullable: true, enum: ['blank', 'non-blank'] })
    }
  }
})

test('stored and virtual generated columns should be read only', async (t) => {
  const { pass, teardown } = t

  const app = fastify()
  app.register(sqlMapper, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      pass('onDatabaseLoad called')

      await clear(db, sql)
      await createBasicGeneratedTests(db, sql)
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

test('PG Arrays', { skip: !isPg }, async (t) => {
  const { pass, teardown } = t

  const app = fastify()
  app.register(sqlMapper, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      pass('onDatabaseLoad called')

      await clear(db, sql)
      await db.query(sql`CREATE TABLE pages (
      id SERIAL PRIMARY KEY,
      title VARCHAR(42) NOT NULL,
      tags VARCHAR(42)[] NOT NULL
    );`)
    }
  })
  teardown(app.close.bind(app))

  await app.ready()

  {
    const page = app.platformatic.entities.page
    const pageJsonSchema = mapSQLEntityToJSONSchema(page)

    t.equal(pageJsonSchema.$id, 'Page')
    t.equal(pageJsonSchema.title, 'Page')
    t.equal(pageJsonSchema.description, 'A Page')
    t.equal(pageJsonSchema.type, 'object')
    t.same(pageJsonSchema.properties.id, { type: 'integer' })
    t.same(pageJsonSchema.properties.title, { type: 'string' })
    t.same(pageJsonSchema.properties.tags, { type: 'array', items: { type: 'string' } })
    t.same(pageJsonSchema.required, ['title', 'tags'])
  }
})
