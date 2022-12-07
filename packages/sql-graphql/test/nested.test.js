'use strict'

const { test } = require('tap')
const sqlGraphQL = require('..')
const sqlMapper = require('@platformatic/sql-mapper')
const fastify = require('fastify')
const { clear, connInfo, isMysql, isSQLite } = require('./helper')

test('nested resolver', async ({ pass, teardown, same, equal }) => {
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

test('disable one-too-many', async ({ pass, teardown, same, equal, match }) => {
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
  teardown(app.close.bind(app))

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
    match(res.json(), {
      errors: [{
        message: 'Cannot query field "pages" on type "Category". Did you mean "name"?'
      }]
    }, 'categories.posts response')
  }
})

test('disable many-to-one relationship', async ({ pass, teardown, same, equal, match }) => {
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
  teardown(app.close.bind(app))

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
    match(res.json(), {
      errors: [{
        message: 'Cannot query field "category" on type "Page". Did you mean "categoryId"?'
      }]
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

test('nested update', async ({ pass, teardown, same, equal }) => {
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

test('nested resolver without `id` suffix', async ({ pass, teardown, same, equal }) => {
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
  teardown(app.close.bind(app))

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
