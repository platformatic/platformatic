'use strict'

const { clear, connInfo, isSQLite, isMariaDB, isPg } = require('./helper')
const { test } = require('node:test')
const { deepEqual: same, equal, ok: pass } = require('node:assert')
const sqlMapper = require('@platformatic/sql-mapper')
const fastify = require('fastify')
const { mapSQLEntityToJSONSchema } = require('..')

async function createBasicPages (db, sql) {
  if (isSQLite) {
    await db.query(sql`CREATE TABLE pages (
      id INTEGER PRIMARY KEY,
      title VARCHAR(42) NOT NULL,
      metadata JSON,
      section NUMERIC,
      created_at TIMESTAMP NOT NULL,
      description TEXT
    );`)
  } else if (isPg) {
    await db.query(sql`CREATE TYPE pagetype as enum ('blank', 'non-blank');
      CREATE TABLE pages (
      id SERIAL PRIMARY KEY,
      title VARCHAR(42) NOT NULL,
      metadata JSON,
      metadata_b JSONB,
      section NUMERIC,
      description TEXT,
      created_at TIMESTAMP NOT NULL,
      type pagetype
    );`)
  } else {
    await db.query(sql`CREATE TABLE pages (
      id INTEGER UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(42) NOT NULL,
      metadata JSON,
      section NUMERIC,
      description TEXT,
      created_at TIMESTAMP NOT NULL,
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
  const app = fastify()
  app.register(sqlMapper, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      pass('onDatabaseLoad called')

      await clear(db, sql)
      await createBasicPages(db, sql)
    }
  })
  t.after(() => app.close())

  await app.ready()

  {
    const page = app.platformatic.entities.page
    const pageJsonSchema = mapSQLEntityToJSONSchema(page)

    equal(pageJsonSchema.$id, 'Page')
    equal(pageJsonSchema.title, 'Page')
    equal(pageJsonSchema.description, 'A Page')
    equal(pageJsonSchema.type, 'object')
    same(pageJsonSchema.properties.id, { type: 'integer' })
    same(pageJsonSchema.properties.title, { type: 'string' })
    same(pageJsonSchema.properties.description, { type: 'string', nullable: true })
    same(pageJsonSchema.properties.section, { type: 'string', nullable: true })
    if (isMariaDB) {
      same(pageJsonSchema.properties.metadata, { type: 'string', nullable: true })
    } else {
      same(pageJsonSchema.properties.metadata, { type: 'object', additionalProperties: true, nullable: true })
    }
    if (isPg) {
      same(pageJsonSchema.properties.metadataB, { type: 'object', additionalProperties: true, nullable: true })
    }
    same(pageJsonSchema.required, ['title'])
    if (!isSQLite) {
      same(pageJsonSchema.properties.type, { type: 'string', nullable: true, enum: ['blank', 'non-blank'] })
    }
  }
})

test('noRequired = true', async (t) => {
  const app = fastify()
  app.register(sqlMapper, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      pass('onDatabaseLoad called')

      await clear(db, sql)
      await createBasicPages(db, sql)
    }
  })
  t.after(() => app.close())

  await app.ready()

  {
    const page = app.platformatic.entities.page
    const pageJsonSchema = mapSQLEntityToJSONSchema(page, {}, true)

    equal(pageJsonSchema.$id, 'Page')
    equal(pageJsonSchema.title, 'Page')
    equal(pageJsonSchema.description, 'A Page')
    equal(pageJsonSchema.type, 'object')
    same(pageJsonSchema.properties.id, { type: 'integer', nullable: true })
    same(pageJsonSchema.properties.title, { type: 'string', nullable: true })
    same(pageJsonSchema.properties.description, { type: 'string', nullable: true })
    same(pageJsonSchema.properties.section, { type: 'string', nullable: true })
    if (isMariaDB) {
      same(pageJsonSchema.properties.metadata, { type: 'string', nullable: true })
    } else {
      same(pageJsonSchema.properties.metadata, { type: 'object', additionalProperties: true, nullable: true })
    }
    if (isPg) {
      same(pageJsonSchema.properties.metadataB, { type: 'object', additionalProperties: true, nullable: true })
    }
    equal(pageJsonSchema.required, undefined)
    if (!isSQLite) {
      same(pageJsonSchema.properties.type, { type: 'string', nullable: true, enum: ['blank', 'non-blank'] })
    }
  }
})

test('ignore one field', async (t) => {
  const app = fastify()
  app.register(sqlMapper, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      pass('onDatabaseLoad called')

      await clear(db, sql)
      await createBasicPages(db, sql)
    }
  })
  t.after(() => app.close())

  await app.ready()

  {
    const page = app.platformatic.entities.page
    const pageJsonSchema = mapSQLEntityToJSONSchema(page, {
      title: true
    })

    equal(pageJsonSchema.$id, 'Page')
    equal(pageJsonSchema.title, 'Page')
    equal(pageJsonSchema.description, 'A Page')
    equal(pageJsonSchema.type, 'object')
    same(pageJsonSchema.properties.id, { type: 'integer' })
    equal(pageJsonSchema.properties.title, undefined)
    same(pageJsonSchema.properties.description, { type: 'string', nullable: true })
    if (isMariaDB) {
      same(pageJsonSchema.properties.metadata, { type: 'string', nullable: true })
    } else {
      same(pageJsonSchema.properties.metadata, { type: 'object', additionalProperties: true, nullable: true })
    }
    if (isPg) {
      same(pageJsonSchema.properties.metadataB, { type: 'object', additionalProperties: true, nullable: true })
    }
    same(pageJsonSchema.required, undefined)
    if (!isSQLite) {
      same(pageJsonSchema.properties.type, { type: 'string', nullable: true, enum: ['blank', 'non-blank'] })
    }
  }
})

test('stored and virtual generated columns should be read only', async (t) => {
  const app = fastify()
  app.register(sqlMapper, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      pass('onDatabaseLoad called')

      await clear(db, sql)
      await createBasicGeneratedTests(db, sql)
    }
  })
  t.after(() => app.close())

  await app.ready()

  {
    const generatedTest = app.platformatic.entities.generatedTest
    const generatedTestJsonSchema = mapSQLEntityToJSONSchema(generatedTest)

    // as of postgresql 15 virtual generated column is not supported
    if (isPg) {
      same(generatedTestJsonSchema.properties.testStored, { type: 'integer', nullable: true, readOnly: true })
    } else {
      same(generatedTestJsonSchema.properties.testStored, { type: 'integer', nullable: true, readOnly: true })
      same(generatedTestJsonSchema.properties.testVirtual, { type: 'integer', nullable: true, readOnly: true })
    }
  }
})

test('PG Arrays', { skip: !isPg }, async (t) => {
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
  t.after(() => app.close())

  await app.ready()

  {
    const page = app.platformatic.entities.page
    const pageJsonSchema = mapSQLEntityToJSONSchema(page)

    equal(pageJsonSchema.$id, 'Page')
    equal(pageJsonSchema.title, 'Page')
    equal(pageJsonSchema.description, 'A Page')
    equal(pageJsonSchema.type, 'object')
    same(pageJsonSchema.properties.id, { type: 'integer' })
    same(pageJsonSchema.properties.title, { type: 'string' })
    same(pageJsonSchema.properties.tags, { type: 'array', items: { type: 'string' } })
    same(pageJsonSchema.required, ['tags', 'title'])
  }
})
