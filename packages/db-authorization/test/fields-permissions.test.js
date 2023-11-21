'use strict'

const { test } = require('node:test')
const { equal, deepEqual, ok } = require('node:assert')
const fastify = require('fastify')
const core = require('@platformatic/db-core')
const { connInfo, clear, isSQLite } = require('./helper')
const auth = require('..')

async function createBasicPages (db, sql) {
  if (isSQLite) {
    await db.query(sql`CREATE TABLE pages (
      id INTEGER PRIMARY KEY,
      title VARCHAR(42) NOT NULL,
      author VARCHAR(100),
      topic VARCHAR(13) NOT NULL,
      reviewed_by VARCHAR(13) NOT NULL,
      user_id INTEGER
    );`)
  } else {
    await db.query(sql`CREATE TABLE pages (
      id SERIAL PRIMARY KEY,
      title VARCHAR(42) NOT NULL,
      author VARCHAR(100),
      topic VARCHAR(13) NOT NULL,
      reviewed_by VARCHAR(13) NOT NULL,
      user_id INTEGER
    );`)
  }
}

test('users can find only the authorized fields', async () => {
  const app = fastify()
  app.register(core, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      ok('onDatabaseLoad called')

      await clear(db, sql)
      await createBasicPages(db, sql)
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
      entity: 'page',
      delete: false,
      defaults: {
        userId: 'X-PLATFORMATIC-USER-ID'
      },
      find: {
        checks: {
          userId: 'X-PLATFORMATIC-USER-ID'
        },
        fields: ['id', 'title', 'topic']
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
            savePage(input: { title: "TITLE_1", author: "AUTHOR_1", topic: "TOPIC_1", reviewedBy: "TEST" }) {
              id
              title
              author 
              topic
              userId
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
          title: 'TITLE_1',
          author: 'AUTHOR_1',
          topic: 'TOPIC_1',
          userId: 42
        }
      }
    }, 'savePage response')
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
          query {
            getPageById(id: 1) {
              id
              title
              topic
            }
          }
        `
      }
    })
    equal(res.statusCode, 200, 'pages status code')
    deepEqual(res.json(), {
      data: {
        getPageById: {
          id: 1,
          title: 'TITLE_1',
          topic: 'TOPIC_1'
        }
      }
    }, 'pages response')
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
          query {
            pages {
              author
              title
              topic
            }
          }
        `
      }
    })

    deepEqual(res.json(), {
      data: {
        pages: null
      },
      errors: [
        {
          message: 'field not allowed: author',
          locations: [
            {
              line: 3,
              column: 13
            }
          ],
          path: [
            'pages'
          ]
        }
      ]
    }, 'pages response')
  }

  {
    const res = await app.inject({
      url: '/pages',
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
    equal(res.statusCode, 401, 'GET /pages status code (Unauthorized)')
    deepEqual(res.json(), {
      statusCode: 401,
      error: 'Unauthorized',
      code: 'PLT_DB_AUTH_FIELD_UNAUTHORIZED',
      message: 'field not allowed: author'
    }, 'GET /pages status response (Unauthorized)')
  }
})

test('users can save only the authorized fields', async () => {
  const app = fastify()
  app.register(core, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      ok('onDatabaseLoad called')

      await clear(db, sql)
      await createBasicPages(db, sql)
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
      entity: 'page',
      delete: false,
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
        },
        fields: ['id', 'title', 'topic', 'reviewedBy']
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
    // Successful save
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: {
        query: `
          mutation {
            savePage(input: { title: "TITLE_1", topic: "TOPIC_1", reviewedBy: "TEST"}) {
              id
              title
              topic
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
          title: 'TITLE_1',
          topic: 'TOPIC_1'
        }
      }
    }, 'savePage response')
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
          query {
            getPageById(id: 1) {
              id
              title
              topic
              author
            }
          }
        `
      }
    })
    equal(res.statusCode, 200, 'pages status code')
    deepEqual(res.json(), {
      data: {
        getPageById: {
          id: 1,
          title: 'TITLE_1',
          topic: 'TOPIC_1',
          author: null
        }
      }
    }, 'pages response')
  }

  {
    // This must fail because forbidden input
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: {
        query: `
          mutation {
            savePage(input: { title: "TITLE_1", author: "XXXXXXXXXXXXXX" ,topic: "TOPIC_1" }) {
              id
              title
              topic
            }
          }
        `
      }
    })
    deepEqual(res.json(), {
      data: {
        savePage: null
      },
      errors: [
        {
          message: 'field not allowed: author',
          locations: [
            {
              line: 3,
              column: 13
            }
          ],
          path: [
            'savePage'
          ]
        }
      ]
    }, 'savePage response')
  }

  {
    // This must fail because forbidden field
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: {
        query: `
          mutation {
            savePage(input: { title: "TITLE_1" ,topic: "TOPIC_1" }) {
              id
              title
              topic
              author
            }
          }
        `
      }
    })
    deepEqual(res.json(), {
      data: {
        savePage: null
      },
      errors: [
        {
          message: 'field not allowed: author',
          locations: [
            {
              line: 3,
              column: 13
            }
          ],
          path: [
            'savePage'
          ]
        }
      ]
    }, 'savePage response')
  }
})

test('users can insert only the authorized fields', async () => {
  const app = fastify()
  app.register(core, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      ok('onDatabaseLoad called')

      await clear(db, sql)
      await createBasicPages(db, sql)
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
      entity: 'page',
      delete: false,
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
        },
        fields: ['id', 'title', 'topic', 'reviewedBy']
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
    // Successful insert
    const books = [{
      title: 'TITLE_1',
      topic: 'TOPIC_1',
      reviewedBy: 'REV_1'
    }, {
      title: 'TITLE_2',
      topic: 'TOPIC_2',
      reviewedBy: 'REV_2'
    }]

    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: {
        Authorization: `Bearer ${token}`
      },
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
          inputs: books
        }
      }
    })
    equal(res.statusCode, 200, 'savePage status code')
    deepEqual(res.json(), {
      data: {
        insertPages: [{
          id: 1,
          title: 'TITLE_1'
        }, {
          id: 2,
          title: 'TITLE_2'
        }]
      }
    }, 'insertPages response')
  }

  {
    // One of the records has a not allowed field: fail
    const books = [{
      title: 'TITLE_1',
      topic: 'TOPIC_1',
      reviewedBy: 'REV_1'
    }, {
      title: 'TITLE_2',
      topic: 'TOPIC_2',
      reviewedBy: 'REV_2',
      author: 'FORBIDDEN'
    }]

    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      headers: {
        Authorization: `Bearer ${token}`
      },
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
          inputs: books
        }
      }
    })

    deepEqual(res.json(), {
      data: {
        insertPages: null
      },
      errors: [
        {
          message: 'field not allowed: author',
          locations: [
            {
              line: 3,
              column: 15
            }
          ],
          path: [
            'insertPages'
          ]
        }
      ]
    }, 'insertPages response')
  }
})

test('app should not start if there are not nullable and not allowed fields in save rule', async () => {
  const app = fastify()
  app.register(core, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      ok('onDatabaseLoad called')

      await clear(db, sql)
      await createBasicPages(db, sql)
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
      entity: 'page',
      delete: false,
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
        },
        fields: ['id', 'title']
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
  try {
    await app.ready()
  } catch (err) {
    deepEqual(err.message, 'missing not nullable field: "topic" in save rule for entity "page"')
  }
})
