'use strict'

const { test } = require('tap')
const sqlGraphQL = require('..')
const sqlMapper = require('@platformatic/sql-mapper')
const fastify = require('fastify')
const { clear, connInfo, isSQLite, isMysql } = require('./helper')

async function createBasicPages (db, sql) {
  if (isSQLite) {
    await db.query(sql`CREATE TABLE pages (
      id INTEGER PRIMARY KEY,
      title VARCHAR(42)
    );`)
  } else {
    await db.query(sql`CREATE TABLE pages (
      id SERIAL PRIMARY KEY,
      title VARCHAR(42)
    );`)
  }
}

test('no modification of entity', async ({ teardown, equal, pass }) => {
  const app = fastify()
  app.register(sqlMapper, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      pass('onDatabaseLoad called')

      await clear(db, sql)
      await createBasicPages(db, sql)
    }
  })
  app.register(sqlGraphQL)
  teardown(app.close.bind(app))

  await app.ready()

  equal(app.platformatic.entities.page.type, undefined, 'no type in entity')

  for (const field of Object.values(app.platformatic.entities.page.fields)) {
    equal(field.type, undefined, `no type in field ${field.camelcase}`)
  }
})

test('no modification of entity with nested data', async ({ pass, teardown, same, equal }) => {
  const app = fastify()
  app.register(sqlMapper, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      pass('onDatabaseLoad called')

      await clear(db, sql)

      if (isMysql) {
        await db.query(sql`
          CREATE TABLE categories (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255)
          );
          CREATE TABLE pages (
            id SERIAL PRIMARY KEY,
            title VARCHAR(42),
            category_id BIGINT UNSIGNED,
            FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
          );
        `)
      } else if (isSQLite) {
        await db.query(sql`
          CREATE TABLE categories (
            id INTEGER PRIMARY KEY,
            name VARCHAR(42)
          );
        `)
        await db.query(sql`
          CREATE TABLE pages (
            id INTEGER PRIMARY KEY,
            title VARCHAR(42),
            category_id INTEGER REFERENCES categories(id)
          );
        `)
      } else {
        await db.query(sql`
          CREATE TABLE categories (
            id SERIAL PRIMARY KEY,
            name VARCHAR(42)
          );
          CREATE TABLE pages (
            id SERIAL PRIMARY KEY,
            title VARCHAR(42),
            category_id INTEGER REFERENCES categories(id)
          );
        `)
      }
    }
  })
  app.register(sqlGraphQL)
  teardown(app.close.bind(app))

  await app.ready()

  equal(app.platformatic.entities.page.type, undefined, 'no type in entity')

  for (const field of Object.values(app.platformatic.entities.page.fields)) {
    equal(field.type, undefined, `no type in field ${field.camelcase}`)
  }

  equal(app.platformatic.entities.category.type, undefined, 'no type in entity')

  for (const field of Object.values(app.platformatic.entities.category.fields)) {
    equal(field.type, undefined, `no type in field ${field.camelcase}`)
  }
})
