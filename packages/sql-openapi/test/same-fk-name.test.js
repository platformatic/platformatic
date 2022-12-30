'use strict'

const { clear, connInfo } = require('./helper')
const { test } = require('tap')
const fastify = require('fastify')
const sqlMapper = require('@platformatic/sql-mapper')
const sqlOpenAPI = require('..')

test('same foreign keys with different names', async ({ equal, same, teardown }) => {
  async function onDatabaseLoad (db, sql) {
    await clear(db, sql)

    await db.query(sql`CREATE TABLE owners (
      id integer NOT NULL,
      PRIMARY KEY (id)
    );`)

    await db.query(sql`CREATE TABLE editors (
      id integer NOT NULL,
      field integer NOT NULL,
      PRIMARY KEY (id),
      CONSTRAINT editors_fk FOREIGN KEY (field) REFERENCES owners (id),
      CONSTRAINT editors_fk_clone FOREIGN KEY (field) REFERENCES owners (id)
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
        field: 1
      }
    })
    equal(res.statusCode, 200, 'POST /editors status code')
    same(res.json(), {
      id: 10,
      field: 1
    }, 'POST /editors response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/editors',
      body: {
        id: 20,
        field: 2
      }
    })
    equal(res.statusCode, 200, 'POST /editors status code')
    same(res.json(), {
      id: 20,
      field: 2
    }, 'POST /editors response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/editors',
      body: {
        id: 30,
        field: 3
      }
    })
    equal(res.statusCode, 200, 'POST /editors status code')
    same(res.json(), {
      id: 30,
      field: 3
    }, 'POST /editors response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/editors',
      body: {
        id: 40,
        field: 'not existing'
      }
    })
    equal(res.statusCode, 400, 'POST /editors status code')
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
      url: '/editors'
    })
    equal(res.statusCode, 200)
    same(res.json(), [
      {
        id: 10,
        field: 1
      },
      {
        id: 20,
        field: 2
      },
      {
        id: 30,
        field: 3
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
      field: 2
    })
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: '/editors/10/field'
    })
    equal(res.statusCode, 200)
    same(res.json(), {
      id: 1
    })
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: '/editors/10/field'
    })
    equal(res.statusCode, 200)
    same(res.json(), {
      id: 1
    })
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: '/editors/10/editorsFkClone'
    })
    equal(res.statusCode, 200, 'the foreign key is duplicated, so an index has been automatically added')
    same(res.json(), {
      id: 1
    })
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: '/editors/20/field'
    })
    equal(res.statusCode, 200)
    same(res.json(), {
      id: 2
    })
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: '/editors/20/editorsFkClone'
    })
    equal(res.statusCode, 200, 'as in the test above, same fk, same result')
    same(res.json(), {
      id: 2
    })
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: '/owners/2/editorField'
    })
    equal(res.statusCode, 200)
    same(res.json(), [
      {
        id: 20,
        field: 2
      }
    ])
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: '/owners/1/editorsFkClone'
    })
    equal(res.statusCode, 200)
    same(res.json(), [
      {
        id: 10,
        field: 1
      }
    ])
  }
})
