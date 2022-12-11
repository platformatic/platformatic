'use strict'

const { test } = require('tap')
const sqlGraphQL = require('..')
const sqlMapper = require('@platformatic/sql-mapper')
const fastify = require('fastify')
const { clear, connInfo, isPg } = require('./helper')

const connInfoWithSchema = {
  ...connInfo,
  schema: ['public', 'myschema']
}

test('should catch GraphQL print schema errors', { skip: !isPg }, async ({ pass, teardown, same }) => {
  const app = fastify()
  app.register(sqlMapper, {
    ...connInfoWithSchema,
    async onDatabaseLoad (db, sql) {
      pass('onDatabaseLoad called')

      await clear(db, sql)

      await db.query(sql`
      CREATE SCHEMA IF NOT EXISTS "myschema";

      CREATE TABLE IF NOT EXISTS "myschema"."template" (
          "id" uuid NOT NULL,
          PRIMARY KEY ("id")
      );
      
      CREATE TABLE IF NOT EXISTS "myschema"."mytable" (
          "id" int4 NOT NULL,
          "template_id" uuid,
          CONSTRAINT "mytable_template" FOREIGN KEY ("template_id") REFERENCES "myschema"."template"("id"),
          PRIMARY KEY ("id")
      );`)
    }
  })

  app.register(sqlGraphQL)
  teardown(app.close.bind(app))

  try {
    await app.ready()
    same(true, false, 'We check that this line never runs, since we should catch the previous error')
  } catch (error) {
    same(error instanceof Error, true, 'We should throw an error')
  }
})
