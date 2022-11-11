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
      description TEXT
    );`)
  } else if (isPg) {
    await db.query(sql`CREATE TYPE pagetype as enum ('blank', 'non-blank');
      CREATE TABLE pages (
      id SERIAL PRIMARY KEY,
      title VARCHAR(42) NOT NULL,
      metadata JSON,
      description TEXT,
      type pagetype
    );`)
  } else {
    await db.query(sql`CREATE TABLE pages (
      id SERIAL PRIMARY KEY,
      title VARCHAR(42) NOT NULL,
      metadata JSON,
      description TEXT,
      type ENUM ('blank', 'non-blank')
    );`)
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
