'use strict'

const { test } = require('tap')
const Fastify = require('fastify')
const mercurius = require('mercurius')
const sqlGraphQL = require('..')
const sqlMapper = require('@platformatic/sql-mapper')
const { clear, connInfo, isSQLite } = require('./helper')

async function createTestService (t, schema, resolvers = {}) {
  const service = Fastify({ logger: { level: 'error' } })
  service.register(mercurius, {
    schema,
    resolvers,
    federationMetadata: true
  })
  await service.listen({ port: 0 })
  return [service, service.server.address().port]
}

const categories = {
  c1: {
    id: 'c1',
    name: 'Food'
  },
  c2: {
    id: 'c2',
    name: 'Places'
  }
}

// This works because the database is reset between tests
const postCategory = {
  1: 'c1',
  2: 'c2',
  3: 'c1',
  4: 'c1'
}

const categoryPost = Object.keys(postCategory).reduce((acc, key) => {
  acc[postCategory[key]] = acc[postCategory[key]] || []
  acc[postCategory[key]].push(key)
  return acc
}, {})

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

async function createTestGatewayServer (t, cacheOpts) {
  const categoryServiceSchema = `
  type Query @extends {
    categories: [Category]
  }

  type Category @key(fields: "id") {
    id: ID! 
    name: String
    posts: [Post]
  }

  type Post @key(fields: "id") @extends {
    id: ID! @external
    category: Category
  }
`
  const categoryServiceResolvers = {
    Query: {
      categories: (root, args, context, info) => {
        t.pass('Query.categories resolved')
        return Object.values(categories)
      }
    },
    Category: {
      posts: (root, args, context, info) => {
        t.pass('Category.posts resolved')
        return categoryPost[root.id]
          ? categoryPost[root.id].map(id => ({ id }))
          : []
      },
      __resolveReference: (category, args, context, info) => {
        t.pass('Category.__resolveReference')
        return categories[category.id]
      }
    },
    Post: {
      category: (root, args, context, info) => {
        t.pass('Post.category resolved')
        return categories[postCategory[root.id]]
      }
    }
  }
  const [categoryService, categoryServicePort] = await createTestService(t, categoryServiceSchema, categoryServiceResolvers)

  const postService = Fastify()
  postService.register(sqlMapper, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      t.pass('onDatabaseLoad called')

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
  postService.register(sqlGraphQL, {
    federationMetadata: true
  })
  await postService.listen({ port: 0 })
  const postServicePort = postService.server.address().port

  await postService.inject({
    method: 'POST',
    url: '/graphql',
    body: {
      query: `
          mutation batch($inputs : [PostInput]!) {
            insertPosts(inputs: $inputs) {
              id
              title
            }
          }
        `,
      variables: {
        inputs: posts
      }
    }
  })

  const gateway = Fastify()
  t.teardown(async () => {
    await gateway.close()
    await categoryService.close()
    await postService.close()
  })
  gateway.register(mercurius, {
    gateway: {
      services: [{
        name: 'category',
        url: `http://localhost:${categoryServicePort}/graphql`
      }, {
        name: 'post',
        url: `http://localhost:${postServicePort}/graphql`
      }]
    }
  })

  return gateway
}

test('extendable', async (t) => {
  const app = await createTestGatewayServer(t)

  const query = `query {
    categories {
      id
      name
      posts {
        id
        title
        longText
        category {
          id
          name
        }
      }
    }
    posts {
      id
      title
      category {
        id
        name
      }
    }
  }`

  const expected = {
    data: {
      categories: [
        {
          id: 'c1',
          name: 'Food',
          posts: [
            {
              id: '1',
              title: 'Post 1',
              longText: 'This is a long text 1',
              category: {
                id: 'c1',
                name: 'Food'
              }
            },
            {
              id: '3',
              title: 'Post 3',
              longText: 'This is a long text 3',
              category: {
                id: 'c1',
                name: 'Food'
              }
            },
            {
              id: '4',
              title: 'Post 4',
              longText: 'This is a long text 4',
              category: {
                id: 'c1',
                name: 'Food'
              }
            }
          ]
        },
        {
          id: 'c2',
          name: 'Places',
          posts: [
            {
              id: '2',
              title: 'Post 2',
              longText: 'This is a long text 2',
              category: {
                id: 'c2',
                name: 'Places'
              }
            }
          ]
        }
      ],
      posts: [
        {
          id: '1',
          title: 'Post 1',
          category: {
            id: 'c1',
            name: 'Food'
          }
        },
        {
          id: '2',
          title: 'Post 2',
          category: {
            id: 'c2',
            name: 'Places'
          }
        },
        {
          id: '3',
          title: 'Post 3',
          category: {
            id: 'c1',
            name: 'Food'
          }
        },
        {
          id: '4',
          title: 'Post 4',
          category: {
            id: 'c1',
            name: 'Food'
          }
        }
      ]
    }
  }

  t.comment('first request')

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: { query }
    })

    t.same(res.json(), expected)
  }

  t.comment('second request')

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: { query }
    })

    t.same(res.json(), expected)
  }
})
