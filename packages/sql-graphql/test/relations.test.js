'use strict'

const { skip, test } = require('tap')
const { tmpdir } = require('os')
const { randomUUID } = require('crypto')
const { join } = require('path')
const sqlGraphQL = require('..')
const sqlMapper = require('@platformatic/sql-mapper')
const fastify = require('fastify')
const { isSQLite, connInfo, clear } = require('./helper')

if (!isSQLite) {
  skip('The db is not SQLite')
  process.exit(0)
}

test('should fail when an unknown foreign key relationship exists', async ({ pass, rejects, same, teardown }) => {
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
            FOREIGN KEY (category_id) REFERENCES subcategories(id) ON DELETE CASCADE
          );
        );`)
    }
  })
  app.register(sqlGraphQL)
  teardown(app.close.bind(app))

  await rejects(app.inject({
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
  }), new Error('No foreign table named "subcategories" was found'))
})

test('should handle multi references', async ({ pass, teardown, same, equal }) => {
  const app = fastify()
  app.register(sqlMapper, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      pass('onDatabaseLoad called')

      await clear(db, sql)

      
      await db.query(sql`
          CREATE TABLE quotes (
            id INTEGER PRIMARY KEY,
            quote TEXT NOT NULL
          );
        );`)
      await db.query(sql`
          CREATE TABLE movies (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL UNIQUE
          );
        );`)
      await db.query(sql`
          ALTER TABLE quotes ADD COLUMN movie_id INTEGER REFERENCES movies(id);
        );`)
      await db.query(sql`
          ALTER TABLE quotes ADD COLUMN another_movie_id INTEGER REFERENCES movies(id);
        );`)
    }
  })
  app.register(sqlGraphQL)
  teardown(app.close.bind(app))

  await app.ready()

  const movies = [{
    id: 1,
    name: 'Harry Potter'
  }]

  const quotes = [{
    id: 1,
    quote: 'Hello Harry',
    movieId: 1,
    anotherMovieId: 1
  }]

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
            mutation batch($inputs : [MovieInput]!) {
              insertMovies(inputs: $inputs) {
                id
                name
              }
            }
          `,
        variables: {
          inputs: movies
        }
      }
    })
    equal(res.statusCode, 200, 'movies status code')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
            mutation batch($inputs : [QuoteInput]!) {
              insertQuotes(inputs: $inputs) {
                id
                quote
              }
            }
          `,
        variables: {
          inputs: quotes
        }
      }
    })
    equal(res.statusCode, 200, 'quotes status code')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
            query {
              quotes {
                id
                movie {
                  id
                }
                anotherMovie {
                  id
                }
              }
            }
          `,
      }
    })
    equal(res.statusCode, 200, 'query quotes')
    same(res.json(), {
      data: {
        quotes: [{
          id: 1,
          movie: {
            id: 1,
          },
          anotherMovie: {
            id: 1
          }
        }]
      }
    }, 'query quote response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
            query {
              movies {
                id
                quotes {
                  id
                }
              }
            }
          `,
      }
    })
    equal(res.statusCode, 200, 'query movies')
    same(res.json(), {
      data: {
        movies: [{
          id: 1,
          quotes: [{
            id: 1
          }]
        }]
      }
    }, 'query movie response')
  }
})
