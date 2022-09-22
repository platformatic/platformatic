'use strict'

const { test } = require('tap')
const sqlGraphQL = require('..')
const sqlMapper = require('@platformatic/sql-mapper')
const fastify = require('fastify')
const { clear, connInfo, isMysql, isSQLite } = require('./helper')

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
          long_text TEXT,
          counter INTEGER
        );`)
      } else {
        await db.query(sql`CREATE TABLE posts (
          id SERIAL PRIMARY KEY,
          title VARCHAR(42),
          long_text TEXT,
          counter INTEGER
        );`)
      }
    }
  })
  app.register(sqlGraphQL)
  teardown(app.close.bind(app))

  await app.ready()

  const posts = [{
    title: 'Dog',
    longText: 'Foo',
    counter: 10
  }, {
    title: 'Cat',
    longText: 'Bar',
    counter: 20
  }, {
    title: 'Mouse',
    longText: 'Baz',
    counter: 30
  }, {
    title: 'Duck',
    longText: 'A duck tale',
    counter: 40
  }]

  {
    const res = await app.inject({
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
    equal(res.statusCode, 200, 'posts status code')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
          query {
            posts(where: { title: { eq: "Dog" } }) {
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
        posts: [{
          id: '1',
          title: 'Dog',
          longText: 'Foo'
        }]
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
            posts(where: { title: { neq: "Dog" } }) {
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
        posts: [{
          id: '2',
          title: 'Cat',
          longText: 'Bar'
        }, {
          id: '3',
          title: 'Mouse',
          longText: 'Baz'
        }, {
          id: '4',
          title: 'Duck',
          longText: 'A duck tale'
        }]
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
            posts(where: { counter: { gt: 10 } }) {
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
        posts: [{
          id: '2',
          title: 'Cat',
          longText: 'Bar'
        }, {
          id: '3',
          title: 'Mouse',
          longText: 'Baz'
        }, {
          id: '4',
          title: 'Duck',
          longText: 'A duck tale'
        }]
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
            posts(where: { counter: { lt: 40 } }) {
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
        posts: [{
          id: '1',
          title: 'Dog',
          longText: 'Foo'
        }, {
          id: '2',
          title: 'Cat',
          longText: 'Bar'
        }, {
          id: '3',
          title: 'Mouse',
          longText: 'Baz'
        }]
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
            posts(where: { counter: { lte: 30 } }) {
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
        posts: [{
          id: '1',
          title: 'Dog',
          longText: 'Foo'
        }, {
          id: '2',
          title: 'Cat',
          longText: 'Bar'
        }, {
          id: '3',
          title: 'Mouse',
          longText: 'Baz'
        }]
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
            posts(where: { counter: { gte: 20 } }) {
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
        posts: [{
          id: '2',
          title: 'Cat',
          longText: 'Bar'
        }, {
          id: '3',
          title: 'Mouse',
          longText: 'Baz'
        }, {
          id: '4',
          title: 'Duck',
          longText: 'A duck tale'
        }]
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
            posts(where: { counter: { in: [20, 30] } }) {
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
        posts: [{
          id: '2',
          title: 'Cat',
          longText: 'Bar'
        }, {
          id: '3',
          title: 'Mouse',
          longText: 'Baz'
        }]
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
            posts(where: { counter: { nin: [10, 40] } }) {
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
        posts: [{
          id: '2',
          title: 'Cat',
          longText: 'Bar'
        }, {
          id: '3',
          title: 'Mouse',
          longText: 'Baz'
        }]
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
            posts(where: { counter: { gt: 10, lt: 40 } }) {
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
        posts: [{
          id: '2',
          title: 'Cat',
          longText: 'Bar'
        }, {
          id: '3',
          title: 'Mouse',
          longText: 'Baz'
        }]
      }
    }, 'posts response')
  }
})

test('nested where', async ({ pass, teardown, same, equal }) => {
  const app = fastify()
  app.register(sqlMapper, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      pass('onDatabaseLoad called')

      await clear(db, sql)

      if (isMysql) {
        await db.query(sql`
          CREATE TABLE owners (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255)
          );
          CREATE TABLE posts (
            id SERIAL PRIMARY KEY,
            title VARCHAR(42),
            long_text TEXT,
            counter INTEGER,
            owner_id BIGINT UNSIGNED,
            FOREIGN KEY (owner_id) REFERENCES owners(id) ON DELETE CASCADE
          );
        `)
      } else if (isSQLite) {
        await db.query(sql`
          CREATE TABLE owners (
            id INTEGER PRIMARY KEY,
            name VARCHAR(255)
          );
        `)

        await db.query(sql`
          CREATE TABLE posts (
            id INTEGER PRIMARY KEY,
            title VARCHAR(42),
            long_text TEXT,
            counter INTEGER,
            owner_id BIGINT UNSIGNED,
            FOREIGN KEY (owner_id) REFERENCES owners(id) ON DELETE CASCADE
          );
        `)
      } else {
        await db.query(sql`
        CREATE TABLE owners (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255)
        );
        CREATE TABLE posts (
          id SERIAL PRIMARY KEY,
          title VARCHAR(42),
          long_text TEXT,
          counter INTEGER,
          owner_id INTEGER REFERENCES owners(id)
        );`)
      }
    }
  })
  app.register(sqlGraphQL)

  teardown(app.close.bind(app))

  await app.ready()

  const owners = [{
    name: 'Matteo'
  }, {
    name: 'Luca'
  }]

  const posts = [{
    title: 'Dog',
    longText: 'Foo',
    counter: 10
  }, {
    title: 'Cat',
    longText: 'Bar',
    counter: 20
  }, {
    title: 'Mouse',
    longText: 'Baz',
    counter: 30
  }, {
    title: 'Duck',
    longText: 'A duck tale',
    counter: 40
  }]

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
          mutation batch($inputs : [OwnerInput]!) {
            insertOwners(inputs: $inputs) {
              id
              name
            }
          }
        `,
        variables: {
          inputs: owners
        }
      }
    })
    const toAssign = [...posts]
    for (const owner of res.json().data.insertOwners) {
      toAssign.shift().ownerId = owner.id
      toAssign.shift().ownerId = owner.id
    }
    await app.inject({
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
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
          query {
            owners {
              id
              name
              posts(where: { counter: { gte: 20 } }) {
                id
                title
                longText
              }
            }
          }
        `
      }
    })
    equal(res.statusCode, 200, 'owners status code')
    same(res.json(), {
      data: {
        owners: [{
          id: '1',
          name: 'Matteo',
          posts: [{
            id: '2',
            title: 'Cat',
            longText: 'Bar'
          }]
        }, {
          id: '2',
          name: 'Luca',
          posts: [{
            id: '3',
            title: 'Mouse',
            longText: 'Baz'
          }, {
            id: '4',
            title: 'Duck',
            longText: 'A duck tale'
          }]
        }]
      }
    }, 'owners response')
  }
})

test('delete', async ({ pass, teardown, same, equal }) => {
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
          long_text TEXT,
          counter INTEGER
        );`)
      } else {
        await db.query(sql`CREATE TABLE posts (
          id SERIAL PRIMARY KEY,
          title VARCHAR(42),
          long_text TEXT,
          counter INTEGER
        );`)
      }
    }
  })
  app.register(sqlGraphQL)
  teardown(app.close.bind(app))

  await app.ready()

  const posts = [{
    title: 'Dog',
    longText: 'Foo',
    counter: 10
  }, {
    title: 'Cat',
    longText: 'Bar',
    counter: 20
  }, {
    title: 'Mouse',
    longText: 'Baz',
    counter: 30
  }, {
    title: 'Duck',
    longText: 'A duck tale',
    counter: 40
  }]

  await app.inject({
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

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
          mutation {
            deletePosts(where: { title: { eq: "Dog" } }) {
              id
              title
              longText
            }
          }
        `
      }
    })
    equal(res.statusCode, 200, 'deletePosts status code')
    same(res.json(), {
      data: {
        deletePosts: [{
          id: 1,
          title: 'Dog',
          longText: 'Foo'
        }]
      }
    }, 'deletePosts response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
          query {
            posts(where: { title: { eq: "Dog" } }) {
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
        posts: []
      }
    }, 'posts response')
  }
})

test('delete all', async ({ pass, teardown, same, equal }) => {
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
          long_text TEXT,
          counter INTEGER
        );`)
      } else {
        await db.query(sql`CREATE TABLE posts (
          id SERIAL PRIMARY KEY,
          title VARCHAR(42),
          long_text TEXT,
          counter INTEGER
        );`)
      }
    }
  })
  app.register(sqlGraphQL)
  teardown(app.close.bind(app))

  await app.ready()

  const posts = [{
    title: 'Dog',
    longText: 'Foo',
    counter: 10
  }, {
    title: 'Cat',
    longText: 'Bar',
    counter: 20
  }, {
    title: 'Mouse',
    longText: 'Baz',
    counter: 30
  }, {
    title: 'Duck',
    longText: 'A duck tale',
    counter: 40
  }]

  await app.inject({
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

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
          mutation {
            deletePosts {
              id
              title
              longText
            }
          }
        `
      }
    })
    equal(res.statusCode, 200, 'deletePosts status code')
    same(res.json(), {
      data: {
        deletePosts: [{
          id: 1,
          title: 'Dog',
          longText: 'Foo'
        }, {
          id: 2,
          title: 'Cat',
          longText: 'Bar'
        }, {
          id: 3,
          title: 'Mouse',
          longText: 'Baz'
        }, {
          id: 4,
          title: 'Duck',
          longText: 'A duck tale'

        }]
      }
    }, 'deletePosts response')
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
        posts: []
      }
    }, 'posts response')
  }
})
