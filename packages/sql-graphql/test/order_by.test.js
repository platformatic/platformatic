'use strict'

const { clear, connInfo, isSQLite, isMysql } = require('./helper')
const { test } = require('node:test')
const { equal, ok: pass, deepEqual: same } = require('node:assert')
const sqlGraphQL = require('..')
const sqlMapper = require('@platformatic/sql-mapper')
const fastify = require('fastify')

test('one-level order by', async (t) => {
  const app = fastify()
  app.register(sqlMapper, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      pass('onDatabaseLoad called')

      await clear(db, sql)

      if (isSQLite) {
        await db.query(sql`CREATE TABLE pages (
          id INTEGER PRIMARY KEY,
          title VARCHAR(42),
          counter INTEGER
        );`)
      } else {
        await db.query(sql`CREATE TABLE pages (
          id SERIAL PRIMARY KEY,
          title VARCHAR(42),
          counter INTEGER
        );`)
      }
    }
  })
  app.register(sqlGraphQL)
  t.after(() => app.close())

  await app.ready()

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
          mutation batch($inputs : [PageInput]!) {
            insertPages (inputs: $inputs) {
              id
              title
              counter
            }
          }
        `,
        variables: {
          inputs: [
            { title: 'Page 1', counter: 3 },
            { title: 'Page 2', counter: 2 },
            { title: 'Page 3', counter: 1 }
          ]
        }
      }
    })
    equal(res.statusCode, 200, 'savePage status code')
    same(res.json(), {
      data: {
        insertPages: [
          { id: 1, title: 'Page 1', counter: 3 },
          { id: 2, title: 'Page 2', counter: 2 },
          { id: 3, title: 'Page 3', counter: 1 }
        ]
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
            pages (orderBy: { field: counter, direction: ASC }) {
              id
              title
              counter
            }
          }
        `
      }
    })
    equal(res.statusCode, 200, 'pages status code')
    same(res.json(), {
      data: {
        pages: [
          { id: 3, title: 'Page 3', counter: 1 },
          { id: 2, title: 'Page 2', counter: 2 },
          { id: 1, title: 'Page 1', counter: 3 }
        ]
      }
    }, 'pages response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
          query {
            pages (orderBy: { field: counter, direction: DESC }) {
              id
              title
              counter
            }
          }
        `
      }
    })
    equal(res.statusCode, 200, 'pages status code')
    same(res.json(), {
      data: {
        pages: [
          { id: 1, title: 'Page 1', counter: 3 },
          { id: 2, title: 'Page 2', counter: 2 },
          { id: 3, title: 'Page 3', counter: 1 }
        ]
      }
    }, 'pages response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
          query {
            pages (orderBy: { field: counter}) {
              id
              title
              counter
            }
          }
        `
      }
    })
    equal(res.statusCode, 400, 'pages status code')
    same(res.json(), {
      data: null,
      errors: [{
        message: 'Field "PageOrderByArguments.direction" of required type "OrderByDirection!" was not provided.',
        locations: [{
          line: 3,
          column: 29
        }
        ]
      }]
    })
  }
})

test('list order by', async (t) => {
  const app = fastify()
  app.register(sqlMapper, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      pass('onDatabaseLoad called')

      await clear(db, sql)

      if (isSQLite) {
        await db.query(sql`CREATE TABLE pages (
          id INTEGER PRIMARY KEY,
          counter INTEGER,
          counter2 INTEGER
        );`)
      } else {
        await db.query(sql`CREATE TABLE pages (
          id SERIAL PRIMARY KEY,
          counter INTEGER,
          counter2 INTEGER
        );`)
      }
    }
  })
  app.register(sqlGraphQL)
  t.after(() => app.close())

  await app.ready()

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
          mutation batch($inputs : [PageInput]!) {
            insertPages (inputs: $inputs) {
              id
              counter
              counter2
            }
          }
        `,
        variables: {
          inputs: [
            { counter: 3, counter2: 3 },
            { counter: 3, counter2: 2 },
            { counter: 1, counter2: 1 }
          ]
        }
      }
    })
    equal(res.statusCode, 200, 'savePage status code')
    same(res.json(), {
      data: {
        insertPages: [
          { id: 1, counter: 3, counter2: 3 },
          { id: 2, counter: 3, counter2: 2 },
          { id: 3, counter: 1, counter2: 1 }
        ]
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
            pages (orderBy: [{ field: counter, direction: ASC }, { field: counter2, direction: DESC }]) {
              id
              counter,
              counter2
            }
          }
        `
      }
    })
    equal(res.statusCode, 200, 'pages status code')
    same(res.json(), {
      data: {
        pages: [
          { id: 3, counter: 1, counter2: 1 },
          { id: 1, counter: 3, counter2: 3 },
          { id: 2, counter: 3, counter2: 2 }
        ]
      }
    }, 'pages response')
  }
})

test('nested order by', async (t) => {
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
  t.after(() => app.close())

  const categories = [{
    name: 'Pets'
  }, {
    name: 'Food'
  }]

  await app.inject({
    method: 'POST',
    url: '/graphql',
    body: {
      query: `
            mutation batch($inputs: [CategoryInput]!) {
              insertCategories(inputs: $inputs) {
                id
                name
              }
            }
          `,
      variables: {
        inputs: categories
      }
    }
  })

  const pages = [{
    title: 'foo',
    categoryId: 1
  }, {
    title: 'bar',
    categoryId: 1
  }]

  await app.inject({
    method: 'POST',
    url: '/graphql',
    body: {
      query: `
            mutation batch($inputs: [PageInput]!) {
              insertPages(inputs: $inputs) {
                id
                title
              }
            }
          `,
      variables: {
        inputs: pages
      }
    }
  })

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
          query {
            categories {
              id
              name
              pages(orderBy: { field: title, direction: ASC }) {
                id
                title
              }
            }
          }
        `
      }
    })
    equal(res.statusCode, 200, 'categories.posts status code')
    same(res.json(), {
      data: {
        categories: [{
          id: 1,
          name: 'Pets',
          pages: [{
            id: 2,
            title: 'bar'
          }, {
            id: 1,
            title: 'foo'
          }]
        }, {
          id: 2,
          name: 'Food',
          pages: []
        }]
      }
    }, 'categories.posts response')
  }
})
