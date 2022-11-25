'use strict'

const { clear, connInfo, isSQLite, isMysql, isPg } = require('./helper')
const { test } = require('tap')
const fastify = require('fastify')
const sqlMapper = require('@platformatic/sql-mapper')
const sqlEvents = require('@platformatic/sql-events')
const sqlGraphQL = require('..')

test('composite primary keys', async ({ equal, same, teardown, rejects }) => {
  /* https://github.com/platformatic/platformatic/issues/299 */
  async function onDatabaseLoad (db, sql) {
    await clear(db, sql)

    if (isSQLite) {
      await db.query(sql`CREATE TABLE pages (
        id INTEGER PRIMARY KEY,
        the_title VARCHAR(42)
      );`)

      await db.query(sql`CREATE TABLE users (
        id INTEGER PRIMARY KEY,
        username VARCHAR(255) NOT NULL
      );`)

      await db.query(sql`CREATE TABLE editors (
        page_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        role VARCHAR(255) NOT NULL,
        CONSTRAINT fk_editor_pages FOREIGN KEY (page_id) REFERENCES pages(id),
        CONSTRAINT fk_editor_users FOREIGN KEY (user_id) REFERENCES users(id),
        PRIMARY KEY (page_id, user_id)
      );`)
    } else if (isPg) {
      await db.query(sql`CREATE TABLE pages (
        id SERIAL PRIMARY KEY,
        the_title VARCHAR(255) NOT NULL
      );`)

      await db.query(sql`CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) NOT NULL
      );`)

      await db.query(sql`CREATE TABLE editors (
        page_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        role VARCHAR(255) NOT NULL,
        CONSTRAINT fk_editor_pages FOREIGN KEY (page_id) REFERENCES pages(id),
        CONSTRAINT fk_editor_users FOREIGN KEY (user_id) REFERENCES users(id),
        PRIMARY KEY (page_id, user_id)
      );`)
    } else if (isMysql) {
      await db.query(sql`CREATE TABLE pages (
        id INTEGER PRIMARY KEY AUTO_INCREMENT,
        the_title VARCHAR(255) NOT NULL
      );`)

      await db.query(sql`CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTO_INCREMENT,
        username VARCHAR(255) NOT NULL
      );`)

      await db.query(sql`CREATE TABLE editors (
        page_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        role VARCHAR(255) NOT NULL,
        CONSTRAINT \`fk_editor_pages\` FOREIGN KEY (page_id) REFERENCES pages (id) ON DELETE CASCADE ON UPDATE RESTRICT,
        CONSTRAINT \`fk_editor_users\` FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE RESTRICT,
        PRIMARY KEY (page_id, user_id)
      );`)
    }
  }

  const app = fastify()
  app.register(sqlMapper, {
    ...connInfo,
    onDatabaseLoad
  })
  app.register(sqlEvents) // needed as if it's present it might throw
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
            savePage(input: { theTitle: "foobar" }) {
              id
              theTitle
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
          theTitle: 'foobar'
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
            saveUser(input: { username: "mcollina" }) {
              id
              username
            }
          }
        `
      }
    })
    equal(res.statusCode, 200, 'saveUser status code')
    same(res.json(), {
      data: {
        saveUser: {
          id: 1,
          username: 'mcollina'
        }
      }
    }, 'saveUser response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
          mutation {
            saveUser(input: { username: "lucamaraschi" }) {
              id
              username
            }
          }
        `
      }
    })
    equal(res.statusCode, 200, 'saveUser status code')
    same(res.json(), {
      data: {
        saveUser: {
          id: 2,
          username: 'lucamaraschi'
        }
      }
    }, 'saveUser response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
          mutation {
            saveEditor(input: { userId: "1", pageId: "1", role: "admin" }) {
              user {
                id
                username
              }
              page {
                id
                theTitle
              }
              role
            }
          }
        `
      }
    })
    equal(res.statusCode, 200, 'saveEditor status code')
    same(res.json(), {
      data: {
        saveEditor: {
          user: {
            id: 1,
            username: 'mcollina'
          },
          page: {
            id: 1,
            theTitle: 'foobar'
          },
          role: 'admin'
        }
      }
    }, 'saveEditor response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
          mutation {
            saveEditor(input: { userId: "2", pageId: "1", role: "author" }) {
              user {
                id
                username
              }
              page {
                id
                theTitle
              }
              role
            }
          }
        `
      }
    })
    equal(res.statusCode, 200, 'saveEditor status code')
    same(res.json(), {
      data: {
        saveEditor: {
          user: {
            id: 2,
            username: 'lucamaraschi'
          },
          page: {
            id: 1,
            theTitle: 'foobar'
          },
          role: 'author'
        }
      }
    }, 'saveEditor response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
          mutation {
            saveEditor(input: { userId: "1", pageId: "1", role: "captain" }) {
              user {
                id
                username
              }
              page {
                id
                theTitle
              }
              role
            }
          }
        `
      }
    })
    equal(res.statusCode, 200, 'saveEditor status code')
    same(res.json(), {
      data: {
        saveEditor: {
          user: {
            id: 1,
            username: 'mcollina'
          },
          page: {
            id: 1,
            theTitle: 'foobar'
          },
          role: 'captain'
        }
      }
    }, 'saveEditor response')
  }

  {
    const res = await app.inject({
      method: 'post',
      url: '/graphql',
      body: {
        query: `
          query {
            editors(orderBy: { field: role, direction: DESC }) {
              user {
                id
                username
              }
              page {
                id
                theTitle
              }
              role
            }
          }
        `
      }
    })
    equal(res.statusCode, 200, 'editors status code')
    same(res.json(), {
      data: {
        editors: [{
          user: {
            id: '1',
            username: 'mcollina'
          },
          page: {
            id: '1',
            theTitle: 'foobar'
          },
          role: 'captain'
        }, {
          user: {
            id: '2',
            username: 'lucamaraschi'
          },
          page: {
            id: '1',
            theTitle: 'foobar'
          },
          role: 'author'
        }]
      }
    }, 'editor response')
  }
})

test('composite primary keys with no foreign keys', async ({ equal, same, teardown, rejects }) => {
  /* https://github.com/platformatic/platformatic/issues/299 */
  async function onDatabaseLoad (db, sql) {
    await clear(db, sql)

    await db.query(sql`CREATE TABLE editors (
      page_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      role VARCHAR(255) NOT NULL,
      PRIMARY KEY (page_id, user_id)
    );`)
  }

  const app = fastify()
  app.register(sqlMapper, {
    ...connInfo,
    onDatabaseLoad
  })
  app.register(sqlEvents) // needed as if it's present it will throw
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
            saveEditor(input: { userId: "1", pageId: "1", role: "admin" }) {
              userId
              pageId
              role
            }
          }
        `
      }
    })
    equal(res.statusCode, 200, 'saveEditor status code')
    same(res.json(), {
      data: {
        saveEditor: {
          userId: '1',
          pageId: '1',
          role: 'admin'
        }
      }
    }, 'saveEditor response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
          mutation {
            saveEditor(input: { userId: "2", pageId: "1", role: "author" }) {
              userId
              pageId
              role
            }
          }
        `
      }
    })
    equal(res.statusCode, 200, 'saveEditor status code')
    same(res.json(), {
      data: {
        saveEditor: {
          userId: '2',
          pageId: '1',
          role: 'author'
        }
      }
    }, 'saveEditor response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
          mutation {
            saveEditor(input: { userId: "1", pageId: "1", role: "captain" }) {
              userId
              pageId
              role
            }
          }
        `
      }
    })
    equal(res.statusCode, 200, 'saveEditor status code')
    same(res.json(), {
      data: {
        saveEditor: {
          userId: 1,
          pageId: 1,
          role: 'captain'
        }
      }
    }, 'saveEditor response')
  }

  {
    const res = await app.inject({
      method: 'post',
      url: '/graphql',
      body: {
        query: `
          query {
            editors(orderBy: { field: role, direction: DESC }) {
              userId
              pageId
              role
            }
          }
        `
      }
    })
    equal(res.statusCode, 200, 'editors status code')
    same(res.json(), {
      data: {
        editors: [{
          userId: '1',
          pageId: '1',
          role: 'captain'
        }, {
          userId: '2',
          pageId: '1',
          role: 'author'
        }]
      }
    }, 'editor response')
  }
})
