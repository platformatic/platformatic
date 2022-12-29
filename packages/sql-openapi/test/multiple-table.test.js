'use strict'

const { clear, connInfo } = require('./helper')
const { test } = require('tap')
const fastify = require('fastify')
const sqlMapper = require('@platformatic/sql-mapper')
const sqlOpenAPI = require('..')

test('multiple tables have foreign keys pointing to the same primary key', async ({ equal, same, teardown }) => {
  async function onDatabaseLoad (db, sql) {
    await clear(db, sql)

    await db.query(sql`CREATE TABLE owners (
      id integer NOT NULL,
      PRIMARY KEY (id)
    );`)

    await db.query(sql`CREATE TABLE editors (
      id integer NOT NULL,
      field1 integer NOT NULL,
      field2 integer NOT NULL,
      PRIMARY KEY (id),
      CONSTRAINT editors_field2_fk FOREIGN KEY (field2) REFERENCES owners (id),
      CONSTRAINT editors_field1_fk FOREIGN KEY (field1) REFERENCES owners (id)
    );`)

    await db.query(sql`CREATE TABLE posts (
      id integer NOT NULL,
      field1 integer NOT NULL,
      field2 integer NOT NULL,
      PRIMARY KEY (id),
      CONSTRAINT posts_field2_fk FOREIGN KEY (field2) REFERENCES owners (id),
      CONSTRAINT posts_field1_fk FOREIGN KEY (field1) REFERENCES owners (id)
    );`)
  }

  const app = fastify()
  try {
    app.register(sqlMapper, {
      ...connInfo,
      onDatabaseLoad
    })
    app.register(sqlOpenAPI)
    teardown(app.close.bind(app))

    await app.ready()
  } catch (error) {
    equal(true, false, 'app should not crash')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/owners',
      body: {
        id: 1
      }
    })
    equal(res.statusCode, 200, 'POST /owners status code')
    same(res.json(), {
      id: 1
    }, 'POST /owners response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/owners',
      body: {
        id: 2
      }
    })
    equal(res.statusCode, 200, 'POST /owners status code')
    same(res.json(), {
      id: 2
    }, 'POST /owners response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/owners',
      body: {
        id: 3
      }
    })
    equal(res.statusCode, 200, 'POST /owners status code')
    same(res.json(), {
      id: 3
    }, 'POST /owners response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/editors',
      body: {
        id: 10,
        field1: 1,
        field2: 2
      }
    })
    equal(res.statusCode, 200, 'POST /editors status code')
    same(res.json(), {
      id: 10,
      field1: 1,
      field2: 2
    }, 'POST /editors response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/editors',
      body: {
        id: 20,
        field1: 2,
        field2: 3
      }
    })
    equal(res.statusCode, 200, 'POST /editors status code')
    same(res.json(), {
      id: 20,
      field1: 2,
      field2: 3
    }, 'POST /editors response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/editors',
      body: {
        id: 30,
        field1: 3,
        field2: 1
      }
    })
    equal(res.statusCode, 200, 'POST /editors status code')
    same(res.json(), {
      id: 30,
      field1: 3,
      field2: 1
    }, 'POST /editors response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/editors',
      body: {
        id: 40,
        field1: 1,
        field2: 'not existing'
      }
    })
    equal(res.statusCode, 400, 'POST /editors status code')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/posts',
      body: {
        id: 1000,
        field1: 1,
        field2: 2
      }
    })
    equal(res.statusCode, 200, 'POST /posts status code')
    same(res.json(), {
      id: 1000,
      field1: 1,
      field2: 2
    }, 'POST /posts response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/posts',
      body: {
        id: 2000,
        field1: 2,
        field2: 3
      }
    })
    equal(res.statusCode, 200, 'POST /posts status code')
    same(res.json(), {
      id: 2000,
      field1: 2,
      field2: 3
    }, 'POST /posts response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/posts',
      body: {
        id: 3000,
        field1: 3,
        field2: 1
      }
    })
    equal(res.statusCode, 200, 'POST /posts status code')
    same(res.json(), {
      id: 3000,
      field1: 3,
      field2: 1
    }, 'POST /posts response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/posts',
      body: {
        id: 4000,
        field1: 'not existing',
        field2: 2
      }
    })
    equal(res.statusCode, 400, 'POST /posts status code')
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: '/owners'
    })
    equal(res.statusCode, 200)
    same(res.json(), [
      { id: 1 },
      { id: 2 },
      { id: 3 }
    ])
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: '/owners/1'
    })
    equal(res.statusCode, 200)
    same(res.json(), {
      id: 1
    })
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: '/owners/1/editorField1'
    })
    equal(res.statusCode, 200)
    same(res.json(), [
      {
        id: 10,
        field1: 1,
        field2: 2
      }
    ])
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: '/owners/2/postField2'
    })
    equal(res.statusCode, 200)
    same(res.json(), [
      {
        id: 1000,
        field1: 1,
        field2: 2
      }
    ])
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: '/editors'
    })
    equal(res.statusCode, 200)
    same(res.json(), [
      {
        id: 10,
        field1: 1,
        field2: 2
      },
      {
        id: 20,
        field1: 2,
        field2: 3
      },
      {
        id: 30,
        field1: 3,
        field2: 1
      }
    ])
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: '/editors/20'
    })
    equal(res.statusCode, 200)
    same(res.json(), {
      id: 20,
      field1: 2,
      field2: 3
    })
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: '/editors/10/field1'
    })
    equal(res.statusCode, 200)
    same(res.json(), {
      id: 1
    })
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: '/editors/20/field2'
    })
    equal(res.statusCode, 200)
    same(res.json(), {
      id: 3
    })
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: '/posts'
    })
    equal(res.statusCode, 200)
    same(res.json(), [
      {
        id: 1000,
        field1: 1,
        field2: 2
      },
      {
        id: 2000,
        field1: 2,
        field2: 3
      },
      {
        id: 3000,
        field1: 3,
        field2: 1
      }
    ])
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: '/posts/3000'
    })
    equal(res.statusCode, 200)
    same(res.json(), {
      id: 3000,
      field1: 3,
      field2: 1
    })
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: '/posts/1000/field2'
    })
    equal(res.statusCode, 200)
    same(res.json(), {
      id: 2
    })
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: '/posts/3000/field1'
    })
    equal(res.statusCode, 200)
    same(res.json(), {
      id: 3
    })
  }
})
