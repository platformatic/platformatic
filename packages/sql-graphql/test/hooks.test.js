'use strict'

const { clear, connInfo, isMysql, isSQLite } = require('./helper')
const { test } = require('tap')
const sqlMapper = require('@platformatic/sql-mapper')
const sqlGraphQL = require('..')
const fastify = require('fastify')

test('basic hooks', async ({ pass, teardown, same, equal, plan }) => {
  plan(22)
  const app = fastify()
  app.register(sqlMapper, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      pass('onDatabaseLoad called')

      await clear(db, sql)

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
    },
    hooks: {
      Page: {
        noKey () {
          // This should never be called
        },
        async save (original, { input, ctx, fields }) {
          pass('save  called')

          equal(ctx.app, app)
          if (!input.id) {
            same(input, {
              title: 'Hello'
            })

            return original({
              input: {
                title: 'Hello from hook'
              },
              fields
            })
          } else {
            same(input, {
              id: 1,
              title: 'Hello World'
            })

            return original({
              input: {
                id: 1,
                title: 'Hello from hook 2'
              },
              fields
            })
          }
        },
        async find (original, args) {
          pass('find called')

          equal(args.ctx.app, app)
          same(args.where, {
            id: {
              in: ['1']
            }
          })
          args.where = {
            id: {
              eq: ['2']
            }
          }
          same(args.fields, ['id', 'title'])
          return original(args)
        },
        async insert (original, args) {
          pass('insert called')

          equal(args.ctx.app, app)
          same(args.inputs, [{
            title: 'Hello'
          }, {
            title: 'Hello World'
          }])
          same(args.fields, ['id', 'title'])
          return original(args)
        }
      }
    }
  })
  app.register(sqlGraphQL)
  teardown(app.close.bind(app))

  await app.ready()

  {
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
          title: 'Hello from hook'
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
            }
          }
        `
      }
    })
    equal(res.statusCode, 200, 'pages status code')
    same(res.json(), {
      data: {
        getPageById: null
      }
    }, 'pages response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
          mutation {
            savePage(input: { id: 1, title: "Hello World" }) {
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
          title: 'Hello from hook 2'
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
              mutation batch($inputs: [PageInput]!) {
                insertPages(inputs: $inputs) {
                  id
                  title
                }
              }
            `,
        variables: {
          inputs: [
            {
              title: 'Hello'
            },
            {
              title: 'Hello World'
            }
          ]
        }
      }
    })

    equal(res.statusCode, 200, 'insertPages status code')
  }
})

test('hooks with relationships', async ({ pass, teardown, same, equal, plan }) => {
  plan(17)
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
            name VARCHAR(255)
          );
        `)
        await db.query(sql`
          CREATE TABLE pages (
            id INTEGER PRIMARY KEY,
            title VARCHAR(42),
            category_id BIGINT UNSIGNED,
            FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
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
    },
    hooks: {
      Page: {
        async save (original, { input, ctx, fields }) {
          pass('save  called')
          equal(ctx.app, app)

          return original({
            input,
            fields
          })
        },
        async find (original, opts) {
          pass('find called')
          equal(opts.ctx.app, app)
          return original(opts)
        }
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
})

test('delete hook', async ({ pass, teardown, same, equal, plan }) => {
  plan(10)
  const app = fastify()
  app.register(sqlMapper, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      await clear(db, sql)

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
    },
    hooks: {
      Page: {
        async delete (original, args) {
          pass('delete called')

          equal(args.ctx.app, app)
          same(args.where, {
            id: {
              eq: '1'
            }
          })
          same(args.fields, ['id', 'title'])
          return original(args)
        }
      }
    }
  })
  app.register(sqlGraphQL)
  teardown(app.close.bind(app))

  await app.ready()

  {
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
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
          mutation {
            deletePages(where: { id: { eq: "1" } }) {
              id
              title
            }
          }
        `
      }
    })
    equal(res.statusCode, 200, 'deletePage status code')
    same(res.json(), {
      data: {
        deletePages: [{
          id: 1,
          title: 'Hello'
        }]
      }
    }, 'deletePage response')
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
            }
          }
        `
      }
    })
    equal(res.statusCode, 200, 'pages status code')
    same(res.json(), {
      data: {
        getPageById: null
      }
    }, 'pages response')
  }
})

test('false resolver no schema', async ({ pass, teardown, same, equal, plan, match }) => {
  plan(5)
  const app = fastify()
  app.register(sqlMapper, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      pass('onDatabaseLoad called')

      await clear(db, sql)

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
  })
  app.register(sqlGraphQL, {
    schema: `
    extend type Query {
      add(a: Int!, b: Int!): Int
    }
    `,
    resolvers: {
      Mutation: {
        savePage: false,
        deletePages: false,
        insertPages: false
      },
      Query: {
        pages: false,
        getPageById: false
      }
    }
  })
  teardown(app.close.bind(app))

  await app.ready()

  {
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
            }
          }
        `
      }
    })
    equal(res.statusCode, 400, 'pages status code')
    match(res.json(), {
      data: null,
      errors: [{
        message: 'Cannot query field "getPageById" on type "Query".',
        locations: [{ line: 3, column: 13 }]
      }]
    })
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
          mutation {
            deletePages(where: { id: { eq: "1" } }) {
              id
              title
            }
          }
        `
      }
    })
    equal(res.statusCode, 200, 'deletePages status code')
  }
})
