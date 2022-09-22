'use strict'

const fastify = require('fastify')
const sqlGraphQL = require('..')
const sqlMapper = require('@platformatic/sql-mapper')
const { isSQLite } = require('./helper')
const { test, skip } = require('tap')
const { tmpdir } = require('os')
const { join } = require('path')
const { randomUUID } = require('crypto')

if (!isSQLite) {
  skip('The db is not SQLite')
  process.exit(0)
}

test('store, close and load', async ({ pass, same, equal }) => {
  const file = join(tmpdir(), randomUUID())
  {
    const app = fastify()
    app.register(sqlMapper, {
      connectionString: `sqlite://${file}`,
      async onDatabaseLoad (db, sql) {
        pass('onDatabaseLoad called')

        await db.query(sql`CREATE TABLE pages (
          id INTEGER PRIMARY KEY,
          title VARCHAR(42)
        );`)
      }
    })
    app.register(sqlGraphQL)

    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
          mutation {
            savePage(input: { title: "Hello" }) {
              id
              title
            }
          }
        `
      }
    })
    equal(res.statusCode, 200, 'savePage status code')
    same(res.json(), {
      data: {
        savePage: {
          id: 1,
          title: 'Hello'
        }
      }
    }, 'savePage response')

    await app.close()
  }

  {
    const app = fastify()
    app.register(sqlMapper, {
      connectionString: `sqlite://${file}`
    })
    app.register(sqlGraphQL)
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
          query {
            getPageById(id: 1) {
              id
              title
            }
          }
        `
      }
    })
    equal(res.statusCode, 200, 'pages status code')
    same(res.json(), {
      data: {
        getPageById: {
          id: 1,
          title: 'Hello'
        }
      }
    }, 'pages response')
    await app.close()
  }
})

test('demo', async ({ pass, same, equal, teardown }) => {
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
            FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
          );
        );`)
    }
  })
  app.register(sqlGraphQL)
  teardown(app.close.bind(app))

  {
    const res = await app.inject({
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
    })
    equal(res.statusCode, 200, 'saveCategory status code')
    same(res.json(), {
      data: {
        saveCategory: {
          id: 1,
          name: 'pets'
        }
      }
    }, 'saveCategory response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
            mutation {
              savePage(input: { title: "Dogs", body: "Dogs are cool", categoryId: "1" }) {
                id
                title
                category {
                  id
                  name
                }
              }
            }
          `
      }
    })
    equal(res.statusCode, 200, 'savePage status code')
    same(res.json(), {
      data: {
        savePage: {
          id: 1,
          title: 'Dogs',
          category: {
            id: 1,
            name: 'pets'
          }
        }
      }
    }, 'savePage response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
            query {
              getPageById (id: "1") {
                id
                title
                category {
                  id
                  name
                }
              }
            }
          `
      }
    })
    equal(res.statusCode, 200, 'getPageById status code')
    same(res.json(), {
      data: {
        getPageById: {
          id: 1,
          title: 'Dogs',
          category: {
            id: 1,
            name: 'pets'
          }
        }
      }
    }, 'saveCategory response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
          query allPages {
            pages {
              title
              category {
                name
              }
            }
          }
        `
      }
    })
    equal(res.statusCode, 200, 'pages status code')
    same(res.json(), {
      data: {
        pages: [{
          title: 'Dogs',
          category: {
            name: 'pets'
          }
        }]
      }
    }, 'pages response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
          query allCategories {
            categories {
              name
              pages {
                title
              }
            }
          }
        `
      }
    })
    equal(res.statusCode, 200, 'categories status code')
    same(res.json(), {
      data: {
        categories: [{
          name: 'pets',
          pages: [{
            title: 'Dogs'
          }]
        }]
      }
    }, 'categories response')
  }
})
