'use strict'

const { skip, test } = require('tap')
const { tmpdir } = require('os')
const { randomUUID } = require('crypto')
const { join } = require('path')
const sqlGraphQL = require('..')
const sqlMapper = require('@platformatic/sql-mapper')
const fastify = require('fastify')
const { isSQLite } = require('./helper')

if (!isSQLite) {
  skip('The db is not SQLite')
  process.exit(0)
}

test('should fail when an unknown foreign key relationship exists', async ({ pass, rejects, same, teardown }) => {
  const file = join(tmpdir(), randomUUID())
  const app = fastify()
  app.register(sqlMapper, {
    connectionString: `sqlite://${file}`,
    async onDatabaseLoad (db, sql) {
      pass('onDatabaseLoad called')

      await db.query(sql`
          CREATE TABLE categories (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL
          );
        );`)

      await db.query(sql`
          CREATE TABLE pages (
            id INTEGER PRIMARY KEY,
            title TEXT,
            body TEXT,
            category_id INTEGER,
            FOREIGN KEY (category_id) REFERENCES subcategories(id) ON DELETE CASCADE
          );
        );`)
    }
  })
  app.register(sqlGraphQL)
  teardown(app.close.bind(app))

  await rejects(app.inject({
    method: 'POST',
    url: '/graphql',
    body: {
      query: `
          mutation {
            saveCategory(input: { name: "pets" }) {
              id
              name
            }
          }
        `
    }
  }), new Error('No foreign table named "subcategories" was found'))
})
