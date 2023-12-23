'use strict'

const { clear, connInfo, isMysql, isSQLite } = require('./helper')
const { test } = require('node:test');
const { deepEqual: same, equal, ok: pass } = require('node:assert');
const { match } = require('@platformatic/utils');
const sqlGraphQL = require('..')
const sqlMapper = require('@platformatic/sql-mapper')
const fastify = require('fastify')

test('nested resolver', async (t) => {
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

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
          mutation {
            savePage(input: { title: "Hello", categoryId: 1 }) {
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
          title: 'Hello',
          category: {
            id: 1,
            name: 'Pets'
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
            getPageById(id: 1) {
              id
              title
              category {
                id
                name
                pages {
                  id
                  title
                  category {
                    id
                    name
                  }
                }
              }
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
          title: 'Hello',
          category: {
            id: 1,
            name: 'Pets',
            pages: [{
              id: 1,
              title: 'Hello',
              category: {
                id: 1,
                name: 'Pets'
              }
            }]
          }
        }
      }
    }, 'pages response')
  }

  // Without ids
  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
          query {
            getPageById(id: 1) {
              title
              category {
                name
                pages {
                  title
                  category {
                    name
                  }
                }
              }
            }
          }
        `
      }
    })
    equal(res.statusCode, 200, 'pages status code')
    same(res.json(), {
      data: {
        getPageById: {
          title: 'Hello',
          category: {
            name: 'Pets',
            pages: [{
              title: 'Hello',
              category: {
                name: 'Pets'
              }
            }]
          }
        }
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
            categories {
              id
              name
              pages {
                id
                title
                category {
                  id
                  name
                }
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
            id: 1,
            title: 'Hello',
            category: {
              id: 1,
              name: 'Pets'
            }
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

test('nested resolver with more of 10 rows in nested entity', async (t) => {
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

  const categories = [
    { name: 'Category 01' },
    { name: 'Category 02' },
    { name: 'Category 03' },
    { name: 'Category 04' },
    { name: 'Category 05' },
    { name: 'Category 06' },
    { name: 'Category 07' },
    { name: 'Category 08' },
    { name: 'Category 09' },
    { name: 'Category 10' },
    { name: 'Category 11' }
  ]
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

  const pages = [
    { title: 'Page 01', categoryId: 1 },
    { title: 'Page 02', categoryId: 2 },
    { title: 'Page 03', categoryId: 3 },
    { title: 'Page 04', categoryId: 4 },
    { title: 'Page 05', categoryId: 5 },
    { title: 'Page 06', categoryId: 6 },
    { title: 'Page 07', categoryId: 7 },
    { title: 'Page 08', categoryId: 8 },
    { title: 'Page 09', categoryId: 9 },
    { title: 'Page 10', categoryId: 10 },
    { title: 'Page 11', categoryId: 11 }
  ]
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
            pages(limit: 100) {
              id
              title
              category {
                id
              }
            }
          }
        `
      }
    })
    equal(res.statusCode, 200, 'pages.category status code')
    same(res.json(), {
      data: {
        pages: [
          { id: 1, title: 'Page 01', category: { id: 1 } },
          { id: 2, title: 'Page 02', category: { id: 2 } },
          { id: 3, title: 'Page 03', category: { id: 3 } },
          { id: 4, title: 'Page 04', category: { id: 4 } },
          { id: 5, title: 'Page 05', category: { id: 5 } },
          { id: 6, title: 'Page 06', category: { id: 6 } },
          { id: 7, title: 'Page 07', category: { id: 7 } },
          { id: 8, title: 'Page 08', category: { id: 8 } },
          { id: 9, title: 'Page 09', category: { id: 9 } },
          { id: 10, title: 'Page 10', category: { id: 10 } },
          { id: 11, title: 'Page 11', category: { id: 11 } }
        ]
      }
    }, 'pages.category response')
  }
})

test('disable one-too-many', async (t) => {
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
  app.register(sqlGraphQL, {
    resolvers: {
      Category: {
        pages: false
      }
    }
  })
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

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
          mutation {
            savePage(input: { title: "Hello", categoryId: 1 }) {
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
          title: 'Hello',
          category: {
            id: 1,
            name: 'Pets'
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
            getPageById(id: 1) {
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
    equal(res.statusCode, 200, 'pages status code')
    same(res.json(), {
      data: {
        getPageById: {
          id: 1,
          title: 'Hello',
          category: {
            id: 1,
            name: 'Pets'
          }
        }
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
            categories {
              id
              name
              pages {
                id
                title
                category {
                  id
                  name
                }
              }
            }
          }
        `
      }
    })
    equal(res.statusCode, 400, 'categories.posts status code')
    pass(match(res.json(), {
      errors: [{
        message: 'Cannot query field "pages" on type "Category". Did you mean "name"?'
      }]
    }, 'categories.posts response'))
  }
})

test('disable many-to-one relationship', async (t) => {
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
  app.register(sqlGraphQL, {
    resolvers: {
      Page: {
        category: false
      }
    }
  })
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

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
          mutation {
            savePage(input: { title: "Hello", categoryId: 1 }) {
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
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
          query {
            getPageById(id: 1) {
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
    equal(res.statusCode, 400, 'pages status code')
    pass(match(res.json(), {
      errors: [{
        message: 'Cannot query field "category" on type "Page". Did you mean "categoryId"?'
      }]
    }, 'pages response'))
  }

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
              pages {
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
            id: 1,
            title: 'Hello'
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

test('nested update', async (t) => {
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

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
          mutation {
            savePage(input: { title: "Hello", categoryId: 1 }) {
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
          title: 'Hello',
          category: {
            id: 1,
            name: 'Pets'
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
            getPageById(id: 1) {
              id
              title
              category {
                id
                name
                pages {
                  id
                  title
                  category {
                    id
                    name
                  }
                }
              }
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
          title: 'Hello',
          category: {
            id: 1,
            name: 'Pets',
            pages: [{
              id: 1,
              title: 'Hello',
              category: {
                id: 1,
                name: 'Pets'
              }
            }]
          }
        }
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
            categories {
              id
              name
              pages {
                id
                title
                category {
                  id
                  name
                }
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
            id: 1,
            title: 'Hello',
            category: {
              id: 1,
              name: 'Pets'
            }
          }]
        }, {
          id: 2,
          name: 'Food',
          pages: []
        }]
      }
    }, 'categories.posts response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
          mutation {
            savePage(input: { title: "Updated", id: 1 }) {
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
          title: 'Updated',
          category: {
            id: 1,
            name: 'Pets'
          }
        }
      }
    }, 'savePage response')
  }
})

test('nested resolver without `id` suffix', async (t) => {
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
            category BIGINT UNSIGNED,
            FOREIGN KEY (category) REFERENCES categories(id) ON DELETE CASCADE
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
            category INTEGER REFERENCES categories(id)
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
            category INTEGER REFERENCES categories(id)
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

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
          mutation {
            savePage(input: { title: "Hello", category: 1 }) {
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
          title: 'Hello',
          category: {
            id: 1,
            name: 'Pets'
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
            getPageById(id: 1) {
              id
              title
              category {
                id
                name
                pages {
                  id
                  title
                  category {
                    id
                    name
                  }
                }
              }
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
          title: 'Hello',
          category: {
            id: 1,
            name: 'Pets',
            pages: [{
              id: 1,
              title: 'Hello',
              category: {
                id: 1,
                name: 'Pets'
              }
            }]
          }
        }
      }
    }, 'pages response')
  }

  // Without ids
  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
          query {
            getPageById(id: 1) {
              title
              category {
                name
                pages {
                  title
                  category {
                    name
                  }
                }
              }
            }
          }
        `
      }
    })
    equal(res.statusCode, 200, 'pages status code')
    same(res.json(), {
      data: {
        getPageById: {
          title: 'Hello',
          category: {
            name: 'Pets',
            pages: [{
              title: 'Hello',
              category: {
                name: 'Pets'
              }
            }]
          }
        }
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
            categories {
              id
              name
              pages {
                id
                title
                category {
                  id
                  name
                }
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
            id: 1,
            title: 'Hello',
            category: {
              id: 1,
              name: 'Pets'
            }
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
