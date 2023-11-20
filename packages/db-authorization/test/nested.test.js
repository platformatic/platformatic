'use strict'

const { test } = require('node:test')
const { equal, deepEqual, ok } = require('node:assert')
const fastify = require('fastify')
const core = require('@platformatic/db-core')
const { connInfo, clear } = require('./helper')
const auth = require('..')

async function createPagesAndCategories (db, sql) {
  await db.query(sql`CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(42)
  );`)
  await db.query(sql`CREATE TABLE pages (
    id SERIAL PRIMARY KEY,
    title VARCHAR(42),
    category_id INTEGER references categories(id),
    user_id INTEGER
  );`)
}

test('categories are global, but pages are user specific', async () => {
  const app = fastify()
  app.register(core, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      ok('onDatabaseLoad called')

      await clear(db, sql)
      await createPagesAndCategories(db, sql)
    }
  })
  app.register(auth, {
    jwt: {
      secret: 'supersecret'
    },
    roleKey: 'X-PLATFORMATIC-ROLE',
    anonymousRole: 'anonymous',
    rules: [{
      role: 'user',
      entity: 'category',
      find: true,
      save: true
    }, {
      role: 'user',
      entity: 'page',
      defaults: {
        userId: 'X-PLATFORMATIC-USER-ID'
      },
      find: {
        checks: {
          userId: 'X-PLATFORMATIC-USER-ID'
        }
      },
      save: {
        checks: {
          userId: 'X-PLATFORMATIC-USER-ID'
        }
      }
    }, {
      role: 'anonymous',
      entity: 'page',
      find: false,
      delete: false,
      save: false
    }]
  })
  test.after(() => {
    app.close()
  })

  await app.ready()

  const token = await app.jwt.sign({
    'X-PLATFORMATIC-USER-ID': 42,
    'X-PLATFORMATIC-ROLE': 'user'
  })

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: {
        query: `
          mutation {
            saveCategory(input: { name: "pets" }) {
              id
            }
          }
        `
      }
    })
    equal(res.statusCode, 200, 'saveCategory status code')
    deepEqual(res.json(), {
      data: {
        saveCategory: {
          id: 1
        }
      }
    }, 'saveCategory response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: {
        Authorization: `Bearer ${token}`
      },
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
    deepEqual(res.json(), {
      data: {
        savePage: {
          id: 1,
          title: 'Hello',
          category: {
            id: 1,
            name: 'pets'
          }
        }
      }
    }, 'savePage response')
  }

  const token2 = await app.jwt.sign({
    'X-PLATFORMATIC-USER-ID': 43,
    'X-PLATFORMATIC-ROLE': 'user'
  })

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: {
        Authorization: `Bearer ${token2}`
      },
      body: {
        query: `
          mutation {
            savePage(input: { categoryId: 1, title: "Hello World" }) {
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
    const data = res.json()
    deepEqual(data, {
      data: {
        savePage: {
          id: 2,
          title: 'Hello World',
          category: {
            id: 1,
            name: 'pets'
          }
        }
      }
    }, 'savePage response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: {
        Authorization: `Bearer ${token2}`
      },
      body: {
        query: `
          query {
            getCategoryById(id: 1) {
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
    equal(res.statusCode, 200, 'getCategoryById status code')
    deepEqual(res.json(), {
      data: {
        getCategoryById: {
          id: 1,
          name: 'pets',
          pages: [{
            id: 2,
            title: 'Hello World'
          }]
        }
      }
    }, 'getCategoryById response')
  }
})

test('specify multiple entities in a rule', async () => {
  const app = fastify()
  app.register(core, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      ok('onDatabaseLoad called')

      await clear(db, sql)
      await createPagesAndCategories(db, sql)
    }
  })
  app.register(auth, {
    jwt: {
      secret: 'supersecret'
    },
    roleKey: 'X-PLATFORMATIC-ROLE',
    anonymousRole: 'anonymous',
    rules: [{
      role: 'admin',
      entity: 'category',
      find: true,
      save: true
    }, {
      role: 'user',
      entity: 'category',
      find: true,
      save: false
    }, {
      role: 'user',
      entity: 'page',
      defaults: {
        userId: 'X-PLATFORMATIC-USER-ID'
      },
      find: true,
      save: {
        checks: {
          userId: 'X-PLATFORMATIC-USER-ID'
        }
      }
    }, {
      role: 'anonymous',
      entities: ['category', 'page'],
      find: true,
      delete: false,
      save: false
    }]
  })
  test.after(() => {
    app.close()
  })

  await app.ready()

  const adminToken = await app.jwt.sign({
    'X-PLATFORMATIC-USER-ID': 1,
    'X-PLATFORMATIC-ROLE': 'admin'
  })

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: {
        Authorization: `Bearer ${adminToken}`
      },
      body: {
        query: `
          mutation {
            saveCategory(input: { name: "pets" }) {
              id
            }
          }
        `
      }
    })
    equal(res.statusCode, 200, 'saveCategory status code')
    deepEqual(res.json(), {
      data: {
        saveCategory: {
          id: 1
        }
      }
    }, 'saveCategory response')
  }

  const token = await app.jwt.sign({
    'X-PLATFORMATIC-USER-ID': 42,
    'X-PLATFORMATIC-ROLE': 'user'
  })

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: {
        Authorization: `Bearer ${token}`
      },
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
    deepEqual(res.json(), {
      data: {
        savePage: {
          id: 1,
          title: 'Hello',
          category: {
            id: 1,
            name: 'pets'
          }
        }
      }
    }, 'savePage response')
  }

  const token2 = await app.jwt.sign({
    'X-PLATFORMATIC-USER-ID': 43,
    'X-PLATFORMATIC-ROLE': 'user'
  })

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: {
        Authorization: `Bearer ${token2}`
      },
      body: {
        query: `
          mutation {
            savePage(input: { categoryId: 1, title: "Hello World" }) {
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
    const data = res.json()
    deepEqual(data, {
      data: {
        savePage: {
          id: 2,
          title: 'Hello World',
          category: {
            id: 1,
            name: 'pets'
          }
        }
      }
    }, 'savePage response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: {
        Authorization: `Bearer ${token2}`
      },
      body: {
        query: `
          query {
            getCategoryById(id: 1) {
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
    equal(res.statusCode, 200, 'getCategoryById status code')
    deepEqual(res.json(), {
      data: {
        getCategoryById: {
          id: 1,
          name: 'pets',
          pages: [{
            id: 1,
            title: 'Hello'
          }, {
            id: 2,
            title: 'Hello World'
          }]
        }
      }
    }, 'getCategoryById response')
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
    equal(res.statusCode, 200, 'categories status code')
    deepEqual(res.json(), {
      data: {
        categories: [{
          id: 1,
          name: 'pets',
          pages: [{
            id: 1,
            title: 'Hello'
          }, {
            id: 2,
            title: 'Hello World'
          }]
        }]
      }
    }, 'categories response')
  }
})
