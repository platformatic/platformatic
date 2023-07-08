'use strict'

const { test } = require('tap')
const { tmpdir } = require('os')
const { randomUUID } = require('crypto')
const { join } = require('path')
const sqlGraphQL = require('..')
const sqlMapper = require('@platformatic/sql-mapper')
const fastify = require('fastify')
const { isSQLite, connInfo, isMysql, clear } = require('./helper')

test('should fail when an unknown foreign key relationship exists', { skip: !isSQLite }, async ({ pass, rejects, same, teardown }) => {
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
  }), 'No foreign table named "subcategories" was found')
})

test('should handle multi references', async ({ pass, teardown, same, equal }) => {
  const app = fastify()
  app.register(sqlMapper, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      pass('onDatabaseLoad called')

      await clear(db, sql)

      if (isMysql) {
        await db.query(sql`
          CREATE TABLE authors (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255)
          );
          CREATE TABLE books (
            id SERIAL PRIMARY KEY,
            title VARCHAR(42),
            author_id BIGINT UNSIGNED,
            another_author_id BIGINT UNSIGNED,
            FOREIGN KEY (author_id) REFERENCES authors(id) ON DELETE CASCADE,
            FOREIGN KEY (another_author_id) REFERENCES authors(id) ON DELETE CASCADE
          );
        `)
      } else if (isSQLite) {
        await db.query(sql`
          CREATE TABLE authors (
            id INTEGER PRIMARY KEY,
            name VARCHAR(255)
          );
        `)
        await db.query(sql`
          CREATE TABLE books (
            id INTEGER PRIMARY KEY,
            title VARCHAR(42),
            author_id BIGINT UNSIGNED,
            another_author_id BIGINT UNSIGNED,
            FOREIGN KEY (author_id) REFERENCES authors(id) ON DELETE CASCADE,
            FOREIGN KEY (another_author_id) REFERENCES authors(id) ON DELETE CASCADE
          );
        `)
      } else {
        await db.query(sql`
          CREATE TABLE authors (
            id SERIAL PRIMARY KEY,
            name VARCHAR(42)
          );
          CREATE TABLE books (
            id SERIAL PRIMARY KEY,
            title VARCHAR(42),
            author_id INTEGER REFERENCES authors(id),
            another_author_id INTEGER REFERENCES authors(id)
          );
        `)
      }
    }
  })
  app.register(sqlGraphQL)
  teardown(app.close.bind(app))

  await app.ready()

  const authors = [{
    id: 1,
    name: 'Mark'
  }]

  const books = [{
    id: 1,
    title: 'Harry',
    authorId: 1,
    anotherAuthorId: 1
  }]

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
            mutation batch($inputs : [AuthorInput]!) {
              insertAuthors(inputs: $inputs) {
                id
                name
              }
            }
          `,
        variables: {
          inputs: authors
        }
      }
    })
    equal(res.statusCode, 200, 'authors status code')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
            mutation batch($inputs : [BookInput]!) {
              insertBooks(inputs: $inputs) {
                id
                title
              }
            }
          `,
        variables: {
          inputs: books
        }
      }
    })
    equal(res.statusCode, 200, 'books status code')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
            query {
              books {
                id
                author {
                  id
                }
                anotherAuthor {
                  id
                }
              }
            }
          `
      }
    })
    equal(res.statusCode, 200, 'query books')
    same(res.json(), {
      data: {
        books: [{
          id: 1,
          author: {
            id: 1
          },
          anotherAuthor: {
            id: 1
          }
        }]
      }
    }, 'query book response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
            query {
              authors {
                id
                books {
                  id
                }
              }
            }
          `
      }
    })
    equal(res.statusCode, 200, 'query authors')
    same(res.json(), {
      data: {
        authors: [{
          id: 1,
          books: [{
            id: 1
          }]
        }]
      }
    }, 'query authors response')
  }
})

test('cut out id exactly from ending when forming a name of relation', async ({ pass, teardown, same, equal }) => {
  const app = fastify()
  app.register(sqlMapper, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      pass('onDatabaseLoad called')

      await clear(db, sql)

      if (isMysql) {
        await db.query(sql`
          CREATE TABLE individuals (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255)
          );
          CREATE TABLE organizations (
            id SERIAL PRIMARY KEY,
            name VARCHAR(42),
            individual_id BIGINT UNSIGNED,
            FOREIGN KEY (individual_id) REFERENCES individuals(id) ON DELETE CASCADE
          );
        `)
      } else if (isSQLite) {
        await db.query(sql`
          CREATE TABLE individuals (
            id INTEGER PRIMARY KEY,
            name VARCHAR(255)
          );
        `)
        await db.query(sql`
          CREATE TABLE organizations (
            id INTEGER PRIMARY KEY,
            name VARCHAR(42),
            individual_id BIGINT UNSIGNED,
            FOREIGN KEY (individual_id) REFERENCES individuals(id) ON DELETE CASCADE
          );
        `)
      } else {
        await db.query(sql`
          CREATE TABLE individuals (
            id SERIAL PRIMARY KEY,
            name VARCHAR(42)
          );
          CREATE TABLE organizations (
            id SERIAL PRIMARY KEY,
            name VARCHAR(42),
            individual_id INTEGER REFERENCES individuals(id)
          );
        `)
      }
    }
  })
  app.register(sqlGraphQL)
  teardown(app.close.bind(app))

  await app.ready()

  const individuals = [{
    id: 1,
    name: 'Mark'
  }]

  const organization = [{
    id: 1,
    name: 'Platformatic',
    individualId: 1
  }]

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
            mutation batch($inputs : [IndividualInput]!) {
              insertIndividuals(inputs: $inputs) {
                id
                name
              }
            }
          `,
        variables: {
          inputs: individuals
        }
      }
    })
    equal(res.statusCode, 200, 'individuals status code')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
            mutation batch($inputs : [OrganizationInput]!) {
              insertOrganizations(inputs: $inputs) {
                id
                name
              }
            }
          `,
        variables: {
          inputs: organization
        }
      }
    })
    equal(res.statusCode, 200, 'organization status code')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
            query {
              organizations {
                id
                name
                individual {
                  id
                  name
                }
              }
            }
          `
      }
    })
    equal(res.statusCode, 200, 'query organization')
    same(res.json(), {
      data: {
        organizations: [{
          id: 1,
          name: 'Platformatic',
          individual: {
            id: 1,
            name: 'Mark'
          }
        }]
      }
    }, 'query organization response')
  }
})

test('should handle reads from save', { only: true }, async ({ pass, teardown, same, equal }) => {
  const app = fastify({ logger: false })
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
          CREATE TABLE authors (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255),
            category_id BIGINT UNSIGNED,
            FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
          );
          CREATE TABLE books (
            id SERIAL PRIMARY KEY,
            title VARCHAR(42),
            author_id BIGINT UNSIGNED,
            category_id BIGINT UNSIGNED,
            FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
            FOREIGN KEY (author_id) REFERENCES authors(id) ON DELETE CASCADE
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
          CREATE TABLE authors (
            id INTEGER PRIMARY KEY,
            name VARCHAR(255),
            category_id BIGINT UNSIGNED,
            FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
          );
        `)
        await db.query(sql`
          CREATE TABLE books (
            id INTEGER PRIMARY KEY,
            title VARCHAR(42),
            author_id BIGINT UNSIGNED,
            category_id BIGINT UNSIGNED,
            FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
            FOREIGN KEY (author_id) REFERENCES authors(id) ON DELETE CASCADE
          );
        `)
      } else {
        await db.query(sql`
          CREATE TABLE categories (
            id SERIAL PRIMARY KEY,
            name VARCHAR(42)
          );

          CREATE TABLE authors (
            id SERIAL PRIMARY KEY,
            name VARCHAR(42),
            category_id INTEGER REFERENCES categories(id)
          );

          CREATE TABLE books (
            id SERIAL PRIMARY KEY,
            title VARCHAR(42),
            category_id INTEGER REFERENCES categories(id),
            author_id INTEGER REFERENCES authors(id)
          );
        `)
      }
    }
  })
  app.register(sqlGraphQL)
  teardown(app.close.bind(app))

  await app.ready()

  const categories = [{
    name: 'Sci-Fi'
  }]

  const authors = [{
    name: 'Mark',
    categoryId: 1
  }]

  const books = [{
    title: 'Harry',
    authorId: 1,
    categoryId: 1
  }]

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
            mutation batch($inputs : [CategoryInput]!) {
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
    equal(res.statusCode, 200, 'categories status code')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
            mutation batch($inputs : [AuthorInput]!) {
              insertAuthors(inputs: $inputs) {
                id
                name
              }
            }
          `,
        variables: {
          inputs: authors
        }
      }
    })
    equal(res.statusCode, 200, 'authors status code')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
            mutation batch($inputs : [BookInput]!) {
              insertBooks(inputs: $inputs) {
                id
                title
              }
            }
          `,
        variables: {
          inputs: books
        }
      }
    })
    equal(res.statusCode, 200, 'books status code')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
            mutation {
              saveAuthor(input: { id: 1, name: "Mark II" }) {
                id
                books {
                  id
                  title
                }
              }
            }
          `,
        variables: {
          inputs: books
        }
      }
    })
    equal(res.statusCode, 200, 'books status code')
    same(res.json(), {
      data: {
        saveAuthor: {
          id: 1,
          books: [{
            id: 1,
            title: 'Harry'
          }]
        }
      }
    })
  }
})

test('should handle nullable relation', async ({ pass, teardown, same, equal }) => {
  const app = fastify()
  app.register(sqlMapper, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      pass('onDatabaseLoad called')

      await clear(db, sql)

      if (isMysql) {
        await db.query(sql`
          CREATE TABLE authors (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255)
          );
          CREATE TABLE books (
            id SERIAL PRIMARY KEY,
            title VARCHAR(42),
            author_id BIGINT UNSIGNED,
            FOREIGN KEY (author_id) REFERENCES authors(id)
          );
        `)
      } else if (isSQLite) {
        await db.query(sql`
          CREATE TABLE authors (
            id INTEGER PRIMARY KEY,
            name VARCHAR(255)
          );
        `)
        await db.query(sql`
          CREATE TABLE books (
            id INTEGER PRIMARY KEY,
            title VARCHAR(42),
            author_id BIGINT UNSIGNED,
            FOREIGN KEY (author_id) REFERENCES authors(id)
          );
        `)
      } else {
        await db.query(sql`
          CREATE TABLE authors (
            id SERIAL PRIMARY KEY,
            name VARCHAR(42)
          );
          CREATE TABLE books (
            id SERIAL PRIMARY KEY,
            title VARCHAR(42),
            author_id INTEGER REFERENCES authors(id)
          );
        `)
      }
    }
  })
  app.register(sqlGraphQL)
  teardown(app.close.bind(app))

  await app.ready()

  const authors = [
    {
      id: 1,
      name: 'Mark 1'
    },
    {
      id: 2,
      name: 'Mark 2'
    }
  ]

  const books = [
    {
      id: 1,
      title: 'Harry 1',
      authorId: 1
    },
    {
      id: 2,
      title: 'Harry 2',
      authorId: null
    },
    {
      id: 3,
      title: 'Harry 3',
      authorId: 2
    }
  ]

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
            mutation batch($inputs : [AuthorInput]!) {
              insertAuthors(inputs: $inputs) {
                id
                name
              }
            }
          `,
        variables: {
          inputs: authors
        }
      }
    })
    equal(res.statusCode, 200, 'authors status code')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
            mutation batch($inputs : [BookInput]!) {
              insertBooks(inputs: $inputs) {
                id
                title
              }
            }
          `,
        variables: {
          inputs: books
        }
      }
    })
    equal(res.statusCode, 200, 'books status code')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
            query {
              books (orderBy: { field: id, direction: ASC }) {
                id
                author {
                  id
                }
              }
            }
          `
      }
    })
    equal(res.statusCode, 200, 'query books')
    same(res.json(), {
      data: {
        books: [
          {
            id: 1,
            author: {
              id: 1
            }
          },
          {
            id: 2,
            author: null
          },
          {
            id: 3,
            author: {
              id: 2
            }
          }
        ]
      }
    }, 'query book response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
            query {
              authors {
                id
                books {
                  id
                }
              }
            }
          `
      }
    })
    equal(res.statusCode, 200, 'query authors')
    same(res.json(), {
      data: {
        authors: [
          {
            id: 1,
            books: [{ id: 1 }]
          },
          {
            id: 2,
            books: [{ id: 3 }]
          }
        ]
      }
    }, 'query authors response')
  }
})
