'use strict'

const { test } = require('tap')
const sqlGraphQL = require('..')
const sqlMapper = require('@platformatic/sql-mapper')
const fastify = require('fastify')
const { clear, connInfo, isSQLite, isMysql, isMariaDB } = require('./helper')

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

test('simple db simple graphql schema', { only: true }, async ({ pass, teardown, same, equal }) => {
  const app = fastify({ logger: { level: 'trace' } })
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
          title: 'Hello World'
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
        getPageById: {
          id: 1,
          title: 'Hello World'
        }
      }
    }, 'pages response')
  }
})

test('with federationMetadata', async ({ pass, teardown, same, equal }) => {
  const app = fastify()
  app.register(sqlMapper, {
    ...connInfo,
    federationMetadata: true,
    async onDatabaseLoad (db, sql) {
      pass('onDatabaseLoad called')

      await clear(db, sql)
      await createBasicPages(db, sql)
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
          title: 'Hello World'
        }
      }
    }, 'savePage response')
  }
})

test('add resolver', async ({ pass, teardown, same, equal }) => {
  const app = fastify()

  const schema = `
    extend type Query {
      search(title: String!): [Page]
    }
  `
  const resolvers = {
    Query: {
      async search (root, args, context, info) {
        pass('search resolver called')
        const { db, sql } = context.app.platformatic
        const res = await db.query(sql`SELECT * FROM pages WHERE title LIKE ${'%' + args.title + '%'}`)

        return res
      }
    }
  }

  app.register(sqlMapper, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      pass('onDatabaseLoad called')

      await clear(db, sql)
      await createBasicPages(db, sql)
    }
  })
  app.register(sqlGraphQL, {
    schema,
    resolvers
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
            savePage(input: { title: "Hello World" }) {
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
          title: 'Hello World'
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
            savePage(input: { title: "ABC" }) {
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
          id: 2,
          title: 'ABC'
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
            search(title: "Hello") {
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
        search: [{
          id: 1,
          title: 'Hello World'
        }]
      }
    }, 'pages response')
  }
})

test('override resolver', async ({ pass, teardown, same, equal, plan }) => {
  plan(3)

  const app = fastify()
  app.register(sqlMapper, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      await clear(db, sql)
      await createBasicPages(db, sql)
    }
  })
  app.register(sqlGraphQL, {
    resolvers: {
      Mutation: {
        async savePage (root, args, context, info) {
          pass('savePage resolver called')
          const { db, sql } = context.app.platformatic
          if (isSQLite) {
            const insert = sql`
              INSERT INTO pages (title)
              VALUES (${args.input.title})
            `

            await db.query(insert)

            const res2 = await db.query(sql`
              SELECT last_insert_rowid()
            `)

            const id = res2[0]['last_insert_rowid()']
            return {
              ...args.input,
              id
            }
          } else if (isMysql && !db.isMariaDB) {
            const insert = sql`
              INSERT INTO pages (title)
              VALUES (${args.input.title})
            `

            await db.query(insert)

            const res2 = await db.query(sql`
              SELECT last_insert_id()
            `)

            const id = res2[0]['last_insert_id()']
            return {
              ...args.input,
              id
            }
          } else {
            const insert = sql`
              INSERT INTO pages (title)
              VALUES (${args.input.title})
              RETURNING *
            `
            const res = await db.query(insert)
            return res[0]
          }
        }
      }
    }
  })
  teardown(app.close.bind(app))

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
})

test('add totally new type and resolver', async ({ pass, teardown, same, equal, plan }) => {
  plan(4)

  const app = fastify()
  app.register(sqlMapper, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      await clear(db, sql)
      await createBasicPages(db, sql)
    }
  })
  app.register(sqlGraphQL, {
    schema: `
      type Category {
        id: ID!
        name: String
        upper: String
      }

      extend type Query {
        getCategory: Category
      }
      `,
    resolvers: {
      Query: {
        async getCategory (root, args, context, info) {
          pass('getCategory resolver called')
          return {
            id: 1,
            name: 'Hello'
          }
        }
      },
      Category: {
        upper (root, args, context, info) {
          pass('name resolver called')
          return root.name.toUpperCase()
        }
      }
    }
  })
  teardown(app.close.bind(app))

  const res = await app.inject({
    method: 'POST',
    url: '/graphql',
    body: {
      query: `
          query {
            getCategory {
              id
              name
              upper
            }
          }
        `
    }
  })
  equal(res.statusCode, 200, 'getCategory status code')
  same(res.json(), {
    data: {
      getCategory: {
        id: 1,
        name: 'Hello',
        upper: 'HELLO'
      }
    }
  }, 'getCategory response')
})

test('list', async ({ pass, teardown, same, equal }) => {
  const app = fastify()
  app.register(sqlMapper, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      pass('onDatabaseLoad called')

      await clear(db, sql)

      if (isSQLite) {
        await db.query(sql`CREATE TABLE posts (
          id INTEGER PRIMARY KEY,
          title VARCHAR(42),
          long_text TEXT
        );`)
      } else {
        await db.query(sql`CREATE TABLE posts (
          id SERIAL PRIMARY KEY,
          title VARCHAR(42),
          long_text TEXT
        );`)
      }
    }
  })
  app.register(sqlGraphQL)
  teardown(app.close.bind(app))

  await app.ready()

  const posts = [{
    title: 'Post 1',
    longText: 'This is a long text 1'
  }, {
    title: 'Post 2',
    longText: 'This is a long text 2'
  }, {
    title: 'Post 3',
    longText: 'This is a long text 3'
  }, {
    title: 'Post 4',
    longText: 'This is a long text 4'
  }]

  for (const post of posts) {
    await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
          mutation {
            savePost(input: { title: "${post.title}", longText: "${post.longText}" }) {
              id
              title,
              longText
            }
          }
        `
      }
    })
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
          query {
            posts {
              id
              title
              longText
            }
          }
        `
      }
    })
    equal(res.statusCode, 200, 'posts status code')
    same(res.json(), {
      data: {
        posts: posts.map((p, i) => {
          return { ...p, id: i + 1 + '' }
        })
      }
    }, 'posts response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
          query {
            posts (limit: 2, offset: 1) {
              id
              title
              longText
            }
          }
        `
      }
    })
    equal(res.statusCode, 200, 'posts status code')
    same(res.json(), {
      data: {
        posts: posts.map((p, i) => {
          return { ...p, id: i + 1 + '' }
        }).slice(1, 3)
      }
    }, 'posts response')
  }
})

test('not found', async ({ pass, teardown, same, equal }) => {
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
    equal(res.statusCode, 200, 'getPageById status code')
    same(res.json(), {
      data: {
        getPageById: null
      }
    }, 'getPageById response')
  }
})

test('graphiql is enabled by default', async ({ pass, teardown, same, equal }) => {
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

  const res = await app.inject('/graphiql')
  equal(res.statusCode, 200)
})

test('graphiql can be disabled', async ({ pass, teardown, same, equal }) => {
  const app = fastify()
  app.register(sqlMapper, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      pass('onDatabaseLoad called')

      await clear(db, sql)
      await createBasicPages(db, sql)
    }
  })
  app.register(sqlGraphQL, {
    graphiql: false
  })
  teardown(app.close.bind(app))

  const res = await app.inject('/graphiql')
  equal(res.statusCode, 404)
})

test('default query hello should be created when no entities are found', async ({ pass, teardown, same, equal }) => {
  const app = fastify()
  app.register(sqlMapper, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      pass('onDatabaseLoad called')
      await clear(db, sql)
    }
  })
  app.register(sqlGraphQL)
  teardown(app.close.bind(app))

  const res = await app.inject({
    method: 'POST',
    url: '/graphql',
    body: {
      query: 'query { hello }'
    }
  })
  equal(res.statusCode, 200)
  same(res.json(), {
    data: {
      hello: 'Hello Platformatic!'
    }
  })
})

test('default query hello should not be created when entities are found', async ({ pass, teardown, same, equal }) => {
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

  const res = await app.inject({
    method: 'POST',
    url: '/graphql',
    body: {
      query: 'query { hello }'
    }
  })
  equal(res.statusCode, 400)
  const json = res.json()
  same(json.data, null)
  same(json.errors[0].message, 'Cannot query field "hello" on type "Query".')
})

test('primary key snake_case', async ({ pass, teardown, same, equal }) => {
  async function createBasicPagesWithSnakeCasePK (db, sql) {
    if (isSQLite) {
      await db.query(sql`CREATE TABLE pages (
      page_id INTEGER PRIMARY KEY,
      title VARCHAR(42)
    );`)
    } else {
      await db.query(sql`CREATE TABLE pages (
      page_id SERIAL PRIMARY KEY,
      title VARCHAR(42)
    );`)
    }
  }

  const app = fastify()
  app.register(sqlMapper, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      pass('onDatabaseLoad called')

      await clear(db, sql)
      await createBasicPagesWithSnakeCasePK(db, sql)
    }
  })
  app.register(sqlGraphQL, {
    graphiql: false
  })
  teardown(app.close.bind(app))

  const res = await app.inject('/graphiql')
  equal(res.statusCode, 404)

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
          mutation {
            savePage(input: { title: "Hello" }) {
              pageId
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
          pageId: 1,
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
            getPageByPageId(pageId: 1) {
              pageId
              title
            }
          }
        `
      }
    })
    equal(res.statusCode, 200, 'pages status code')
    same(res.json(), {
      data: {
        getPageByPageId: {
          pageId: 1,
          title: 'Hello'
        }
      }
    }, 'pages response')
  }
})

test('deserialize JSON columns', { skip: isSQLite }, async (t) => {
  const { pass, teardown, same } = t
  const app = fastify()
  const jsonData = {
    foo: 'bar',
    baz: 42,
    items: ['foo', 'bar'],
    nested: {
      hello: 'world'
    }
  }
  app.register(sqlMapper, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      pass('onDatabaseLoad called')

      await clear(db, sql)

      await db.query(sql`CREATE TABLE pages (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        metadata JSON NOT NULL
      );`)

      await db.query(sql`INSERT INTO pages (id, title, metadata) VALUES (1, 'Hello World', ${JSON.stringify(jsonData)})`)
    }
  })
  app.register(sqlGraphQL, {
    graphiql: false
  })
  teardown(app.close.bind(app))

  await app.ready()
  const res = await app.inject({
    method: 'POST',
    url: '/graphql',
    body: {
      query: `
        query {
          getPageById(id: 1) {
            id
            title
            metadata
          }
        }
      `
    }
  })
  const json = res.json()
  if (isMariaDB) {
    same(json.data.getPageById.metadata, JSON.stringify(jsonData))
  } else {
    same(json.data.getPageById.metadata, jsonData)
  }
})
