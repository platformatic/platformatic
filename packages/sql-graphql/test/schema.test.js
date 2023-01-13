'use strict'

const { test } = require('tap')
const sqlGraphQL = require('..')
const sqlMapper = require('@platformatic/sql-mapper')
const fastify = require('fastify')
const { isSQLite, isPg, connInfo, isMysql, clear } = require('./helper')

test('should handle relationships with different schemas', { skip: isSQLite }, async ({ pass, teardown, same, equal }) => {
  const app = fastify()
  app.register(sqlMapper, {
    ...connInfo,
    schema: ['test1', 'test2'],
    async onDatabaseLoad (db, sql) {
      pass('onDatabaseLoad called')

      await clear(db, sql)

      await db.query(sql`CREATE SCHEMA IF NOT EXISTS test1;`)
      await db.query(sql`CREATE SCHEMA IF NOT EXISTS test2;`)
      if (isMysql) {
        await db.query(sql`
          CREATE TABLE test1.authors (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255)
          );`)
        await db.query(sql`
          CREATE TABLE test2.books (
            id SERIAL PRIMARY KEY,
            title VARCHAR(42),
            author_id BIGINT UNSIGNED,
            FOREIGN KEY(author_id) REFERENCES test1.authors(id) ON DELETE CASCADE
          );
        `)
      } else {
        await db.query(sql`
          CREATE TABLE test1.authors (
            id SERIAL PRIMARY KEY,
            name VARCHAR(42)
          );
          CREATE TABLE test2.books (
            id SERIAL PRIMARY KEY,
            title VARCHAR(42),
            author_id INTEGER REFERENCES test1.authors(id)
          );
        `)
      }
    }
  })
  app.register(sqlGraphQL)
  teardown(app.close.bind(app))

  await app.ready()

  const authors = [{
    id: 1,
    name: 'Mark'
  }]

  const books = [{
    id: 1,
    title: 'Harry',
    authorId: 1
  }]

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
            mutation batch($inputs : [Test1AuthorInput]!) {
              insertTest1Authors(inputs: $inputs) {
                id
                name
              }
            }
          `,
        variables: {
          inputs: authors
        }
      }
    })
    equal(res.statusCode, 200, 'authors status code')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
            mutation batch($inputs : [Test2BookInput]!) {
              insertTest2Books(inputs: $inputs) {
                id
                title
              }
            }
          `,
        variables: {
          inputs: books
        }
      }
    })
    equal(res.statusCode, 200, 'books status code')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
            query {
              test2Books {
                id
                author {
                  id
                } 
              }
            }
          `
      }
    })
    equal(res.statusCode, 200, 'query books')
    same(res.json(), {
      data: {
        test2Books: [{
          id: 1,
          author: {
            id: 1
          }
        }]
      }
    }, 'query book response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
            query {
              test1Authors {
                id
                test2Books {
                  id
                }
              }
            }
          `
      }
    })
    equal(res.statusCode, 200, 'query authors')
    same(res.json(), {
      data: {
        test1Authors: [{
          id: 1,
          test2Books: [{
            id: 1
          }]
        }]
      }
    }, 'query authors response')
  }
})

test('should not throw if all of the schema with contraint references are loaded on the config', { skip: !isPg }, async ({ pass, teardown, same }) => {
  const app = fastify()
  app.register(sqlMapper, {
    ...connInfo,
    schema: ['test1', 'test2', 'test3', 'test4'],
    async onDatabaseLoad (db, sql) {
      pass('onDatabaseLoad called')

      await clear(db, sql)

      await db.query(sql`CREATE SCHEMA IF NOT EXISTS test1;`)
      await db.query(sql`CREATE SCHEMA IF NOT EXISTS test2;`)
      await db.query(sql`CREATE SCHEMA IF NOT EXISTS test3;`)
      await db.query(sql`CREATE SCHEMA IF NOT EXISTS test4;`)
      await db.query(sql`
        CREATE TABLE test1.authors (
          id INTEGER PRIMARY KEY,
          name VARCHAR(42)
        );
        
        CREATE TABLE test2.books (
          id INTEGER PRIMARY KEY,
          title VARCHAR(42),
          author_id INTEGER
        );
        
        CREATE TABLE test3.authors (
          id INTEGER PRIMARY KEY,
          name VARCHAR(42)
        );
        
        CREATE TABLE test4.books (
          id INTEGER PRIMARY KEY,
          title VARCHAR(42),
          author_id INTEGER
        );
        
        ALTER TABLE ONLY test2.books
          ADD CONSTRAINT authors_fkey FOREIGN KEY (author_id) REFERENCES test1.authors(id);
        
        ALTER TABLE ONLY test4.books
          ADD CONSTRAINT authors_fkey FOREIGN KEY (author_id) REFERENCES test3.authors(id);
      `)
    }
  })
  app.register(sqlGraphQL)
  teardown(app.close.bind(app))

  try {
    await app.ready()
  } catch (error) {
    same(true, false, 'app should not throw')
  }
})

test('should throw if some of the schema with contraint references are not passed to the config', { skip: !isPg }, async ({ pass, teardown, same, ok }) => {
  const app = fastify()
  app.register(sqlMapper, {
    ...connInfo,
    schema: ['test1', 'test2'],
    async onDatabaseLoad (db, sql) {
      pass('onDatabaseLoad called')

      await clear(db, sql)

      await db.query(sql`CREATE SCHEMA IF NOT EXISTS test1;`)
      await db.query(sql`CREATE SCHEMA IF NOT EXISTS test2;`)
      await db.query(sql`CREATE SCHEMA IF NOT EXISTS test3;`)
      await db.query(sql`CREATE SCHEMA IF NOT EXISTS test4;`)
      await db.query(sql`
        CREATE TABLE test1.authors (
          id INTEGER PRIMARY KEY,
          name VARCHAR(42)
        );
        
        CREATE TABLE test2.books (
          id INTEGER PRIMARY KEY,
          title VARCHAR(42),
          author_id INTEGER
        );
        
        CREATE TABLE test3.authors (
          id INTEGER PRIMARY KEY,
          name VARCHAR(42)
        );
        
        CREATE TABLE test4.books (
          id INTEGER PRIMARY KEY,
          title VARCHAR(42),
          author_id INTEGER
        );
        
        ALTER TABLE ONLY test2.books
          ADD CONSTRAINT authors_fkey FOREIGN KEY (author_id) REFERENCES test1.authors(id);
        
        ALTER TABLE ONLY test4.books
          ADD CONSTRAINT authors_fkey FOREIGN KEY (author_id) REFERENCES test3.authors(id);
      `)
    }
  })
  app.register(sqlGraphQL)
  teardown(app.close.bind(app))

  try {
    await app.ready()
    same(true, false, 'we expect the app to throw')
  } catch (error) {
    same(error.name, 'AssertionError')
    ok(error.message.includes('No foreign table named "authors" was found (table: "books", foreign table: "authors", column: "author_id").'))
    ok(error.message.includes('"constraint_schema": "test2"'))
    ok(error.message.includes('"constraint_name": "authors_fkey"'))
    ok(error.message.includes('"table_schema": "test2"'))
    ok(error.message.includes('"table_name": "books'))
    ok(error.message.includes('"table_schema": "test2"'))
    ok(error.message.includes('"column_name": "author_id"'))
    ok(error.message.includes('"foreign_table_name": "authors"'))
    ok(error.message.includes('"foreign_column_name": "id"'))
    ok(error.message.includes('"foreign_table_schema": "test3"'))
  }
})
