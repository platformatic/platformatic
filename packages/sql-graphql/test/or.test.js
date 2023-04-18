'use strict'

const { test } = require('tap')
const sqlGraphQL = require('..')
const sqlMapper = require('@platformatic/sql-mapper')
const fastify = require('fastify')
const { clear, connInfo, isSQLite } = require('./helper')

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
            posts(where: { or: [ { title: { eq: "Dog" } }, { title: { eq: "Cat" } } ] }) {
              id
              title
              longText
              counter
            }
          }
        `
      }
    })
    equal(res.statusCode, 200, 'posts status code')
    same(res.json(), {
      data: {
        posts: [
          { id: '1', title: 'Dog', longText: 'Foo', counter: 10 },
          { id: '2', title: 'Cat', longText: 'Bar', counter: 20 }
        ]
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
            posts(where: { id: { eq: 1 }, or: [ { title: { eq: "Dog" } }, { title: { eq: "Cat" } } ] }) {
              id
              title
              longText
              counter
            }
          }
        `
      }
    })
    equal(res.statusCode, 200, 'posts status code')
    same(res.json(), {
      data: {
        posts: [
          { id: '1', title: 'Dog', longText: 'Foo', counter: 10 }
        ]
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
            posts(where: { or: [ { counter: { eq: 10 } }, { counter: { eq: 20 } } ] }) {
              id
              title
              longText
              counter
            }
          }
        `
      }
    })
    equal(res.statusCode, 200, 'posts status code')
    same(res.json(), {
      data: {
        posts: [
          { id: '1', title: 'Dog', longText: 'Foo', counter: 10 },
          { id: '2', title: 'Cat', longText: 'Bar', counter: 20 }
        ]
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
            posts(where: { or: [ { counter: { eq: 10 } }, { counter: { gte: 30 } } ] }) {
              id
              title
              longText
              counter
            }
          }
        `
      }
    })
    equal(res.statusCode, 200, 'posts status code')
    same(res.json(), {
      data: {
        posts: [
          { id: '1', title: 'Dog', longText: 'Foo', counter: 10 },
          { id: '3', title: 'Mouse', longText: 'Baz', counter: 30 },
          { id: '4', title: 'Duck', longText: 'A duck tale', counter: 40 }
        ]
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
            posts(where: { or: [ { title: { eq: "Dog" } }, { title: { eq: "Duck" } } ] }) {
              id
              title
              longText
              counter
            }
          }
        `
      }
    })
    equal(res.statusCode, 200, 'posts status code')
    same(res.json(), {
      data: {
        posts: [
          { id: '1', title: 'Dog', longText: 'Foo', counter: 10 },
          { id: '4', title: 'Duck', longText: 'A duck tale', counter: 40 }
        ]
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
            posts(where: { or: [ { title: { eq: "Dog" } }, { longText: { eq: "Baz" } } ] }) {
              id
              title
              longText
              counter
            }
          }
        `
      }
    })
    equal(res.statusCode, 200, 'posts status code')
    same(res.json(), {
      data: {
        posts: [
          { id: '1', title: 'Dog', longText: 'Foo', counter: 10 },
          { id: '3', title: 'Mouse', longText: 'Baz', counter: 30 }
        ]
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
            posts(where: { counter: { in: [10, 20] }, or: [ { title: { eq: "Dog" } }, { longText: { eq: "Baz" } } ] }) {
              id
              title
              longText
              counter
            }
          }
        `
      }
    })
    equal(res.statusCode, 200, 'posts status code')
    same(res.json(), {
      data: {
        posts: [
          { id: '1', title: 'Dog', longText: 'Foo', counter: 10 }
        ]
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
            posts(where: { or: [ { counter: { in: [10, 20] } }, { counter: { in: [20, 30] } } ] }) {
              id
              title
              longText
              counter
            }
          }
        `
      }
    })
    equal(res.statusCode, 200, 'posts status code')
    same(res.json(), {
      data: {
        posts: [
          { id: '1', title: 'Dog', longText: 'Foo', counter: 10 },
          { id: '2', title: 'Cat', longText: 'Bar', counter: 20 },
          { id: '3', title: 'Mouse', longText: 'Baz', counter: 30 }
        ]
      }
    }, 'posts response')
  }
})
