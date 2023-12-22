'use strict'

const { clear, connInfo, isSQLite, isMysql } = require('./helper')
const t = require('tap')
const fastify = require('fastify')
const sqlOpenAPI = require('..')
const sqlMapper = require('@platformatic/sql-mapper')
const { resolve } = require('path')
const { test } = t

Object.defineProperty(t, 'fullname', {
  value: 'platformatic/db/openapi/where'
})

test('list', async (t) => {
  const { pass, teardown, same, equal, matchSnapshot } = t
  t.snapshotFile = resolve(__dirname, 'tap-snapshots', 'where-openapi-1.cjs')
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
      } else if (isMysql) {
        await db.query(sql`CREATE TABLE posts (
          id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
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
  app.register(sqlOpenAPI)
  teardown(app.close.bind(app))

  await app.ready()

  {
    const res = await app.inject({
      method: 'GET',
      url: '/documentation/json'
    })
    const openapi = res.json()
    matchSnapshot(openapi, 'matches expected OpenAPI defs')
  }

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

  for (const body of posts) {
    const res = await app.inject({
      method: 'POST',
      url: '/posts',
      body
    })
    equal(res.statusCode, 200, 'POST /posts status code')
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: '/posts?fields=id,title,longText'
    })
    equal(res.statusCode, 200, 'GET /posts?fields=id,title,longText status code')
    same(res.json(), [{
      id: '1',
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
    }], 'GET /posts?fields=id,title,longText response')
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: '/posts?where.title.eq=Dog&fields=id,title,longText'
    })
    equal(res.statusCode, 200, 'GET /posts?where.title.eq=Dog status code')
    same(res.json(), [{
      id: '1',
      title: 'Dog',
      longText: 'Foo'
    }], 'GET /posts?where.title.eq=Dog response')
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: '/posts?where.title.neq=Dog&fields=id,title,longText'
    })
    equal(res.statusCode, 200, 'GET /posts?where.title.neq=Dog status code')
    same(res.json(), [{
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
    }], 'GET /posts?where.title.neq=Dog response')
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: '/posts?where.counter.gt=10&fields=id,title,longText'
    })
    equal(res.statusCode, 200, 'GET /posts?where.counter.gt=10 status code')
    same(res.json(), [{
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
    }], 'GET /posts?where.counter.gt=10 response')
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: '/posts?where.counter.lt=40&fields=id,title,longText'
    })
    equal(res.statusCode, 200, 'GET /posts?where.counter.lt=40 status code')
    same(res.json(), [{
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
    }], 'GET /posts?where.counter.lt=40 response')
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: '/posts?where.counter.lte=30&fields=id,title,longText'
    })
    equal(res.statusCode, 200, 'GET /posts?where.counter.lte=30 posts status code')
    same(res.json(), [{
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
    }], 'GET /posts?where.counter.lte=30 response')
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: '/posts?where.counter.gte=20&fields=id,title,longText'
    })
    equal(res.statusCode, 200, 'GET /posts?where.counter.gte=20 status code')
    same(res.json(), [{
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
    }], 'GET /posts?where.counter.gte=20 response')
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: '/posts?where.counter.in=20,30&fields=id,title,longText'
    })
    equal(res.statusCode, 200, 'posts status code')
    same(res.json(), [{
      id: '2',
      title: 'Cat',
      longText: 'Bar'
    }, {
      id: '3',
      title: 'Mouse',
      longText: 'Baz'
    }], 'posts response')
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: '/posts?where.counter.nin=10,40&fields=id,title,longText'
    })
    equal(res.statusCode, 200, '/posts status code')
    same(res.json(), [{
      id: '2',
      title: 'Cat',
      longText: 'Bar'
    }, {
      id: '3',
      title: 'Mouse',
      longText: 'Baz'
    }], '/posts response')
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: '/posts?where.counter.gt=10&where.counter.lt=40&fields=id,title,longText'
    })
    equal(res.statusCode, 200, '/posts status code')
    same(res.json(), [{
      id: '2',
      title: 'Cat',
      longText: 'Bar'
    }, {
      id: '3',
      title: 'Mouse',
      longText: 'Baz'
    }], 'posts response')
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: '/posts?where.title.in=Dog,Cat&fields=id,title,longText'
    })
    equal(res.statusCode, 200, 'GET /posts?where.title.in=Dog,Cat status code')
    same(res.json(), [{
      id: '1',
      title: 'Dog',
      longText: 'Foo'
    }, {
      id: '2',
      title: 'Cat',
      longText: 'Bar'
    }], 'GET /posts?where.title.in=Dog,Cat response')
  }

  // Skip unknown properties now
  {
    const res = await app.inject({
      method: 'GET',
      url: '/posts?where.foo.in=Dog,Cat&fields=id,title,longText'
    })
    equal(res.statusCode, 200, 'GET /posts?where.title.in=Dog,Cat status code')
    same(res.json(), [{
      id: '1',
      title: 'Dog',
      longText: 'Foo'
    }, {
      id: '2',
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
    }], 'GET /posts?where.title.in=Dog,Cat response')
  }
})

test('nested where', async (t) => {
  const { pass, teardown, same, equal, matchSnapshot } = t
  t.snapshotFile = resolve(__dirname, 'tap-snapshots', 'where-openapi-2.cjs')
  const app = fastify()
  app.register(sqlMapper, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      pass('onDatabaseLoad called')

      await clear(db, sql)

      if (isMysql) {
        await db.query(sql`
          CREATE TABLE owners (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255)
          );
          CREATE TABLE posts (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            title VARCHAR(42),
            long_text TEXT,
            counter INTEGER,
            owner_id INT UNSIGNED,
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
  app.register(sqlOpenAPI)
  teardown(app.close.bind(app))

  await app.ready()

  {
    const res = await app.inject({
      method: 'GET',
      url: '/documentation/json'
    })
    const openapi = res.json()
    matchSnapshot(openapi, 'matches expected OpenAPI defs')
  }

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
    const toAssign = [...posts]
    for (const body of owners) {
      const res = await app.inject({
        method: 'POST',
        url: '/owners',
        body
      })
      equal(res.statusCode, 200, 'POST /owners status code')
      const ownerId = res.json().id
      // works because we have 2 owners and 4 posts
      toAssign.shift().ownerId = ownerId
      toAssign.shift().ownerId = ownerId
    }

    for (const body of posts) {
      const res = await app.inject({
        method: 'POST',
        url: '/posts',
        body
      })
      equal(res.statusCode, 200, 'POST /posts status code')
    }
  }

  {
    const res1 = await app.inject({
      method: 'GET',
      url: '/owners?fields=id,name'
    })

    equal(res1.statusCode, 200, 'GET /owners status code')
    const expected = [...posts]
    for (const owner of res1.json()) {
      const res2 = await app.inject({
        method: 'GET',
        url: `/posts?where.ownerId.eq=${owner.id}&fields=title,longText,counter,ownerId`
      })
      equal(res2.statusCode, 200, 'GET /posts status code')
      same(res2.json(), [expected.shift(), expected.shift()], 'GET /posts response')
    }
  }
})

test('list with NOT NULL', async (t) => {
  const { pass, teardown, same, equal, matchSnapshot } = t
  t.snapshotFile = resolve(__dirname, 'tap-snapshots', 'where-openapi-3.cjs')
  const app = fastify()
  app.register(sqlMapper, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      pass('onDatabaseLoad called')

      await clear(db, sql)

      if (isSQLite) {
        await db.query(sql`CREATE TABLE posts (
          id INTEGER PRIMARY KEY,
          title VARCHAR(42) NOT NULL,
          long_text TEXT NOT NULL,
          counter INTEGER NOT NULL
        );`)
      } else if (isMysql) {
        await db.query(sql`CREATE TABLE posts (
          id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
          counter INTEGER NOT NULL,
          long_text TEXT NOT NULL,
          title VARCHAR(42) NOT NULL
        );`)
      } else {
        await db.query(sql`CREATE TABLE posts (
          id SERIAL PRIMARY KEY,
          title VARCHAR(42) NOT NULL,
          long_text TEXT NOT NULL,
          counter INTEGER NOT NULL
        );`)
      }
    }
  })
  app.register(sqlOpenAPI)
  teardown(app.close.bind(app))

  await app.ready()

  {
    const res = await app.inject({
      method: 'GET',
      url: '/documentation/json'
    })
    const openapi = res.json()
    matchSnapshot(openapi, 'matches expected OpenAPI defs')
  }

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

  for (const body of posts) {
    const res = await app.inject({
      method: 'POST',
      url: '/posts',
      body
    })
    equal(res.statusCode, 200, 'POST /posts status code')
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: '/posts?fields=id,title,longText'
    })
    equal(res.statusCode, 200, 'GET /posts?fields=id,title,longText status code')
    same(res.json(), [{
      id: '1',
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
    }], 'GET /posts?fields=id,title,longText response')
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: '/posts?where.title.eq=Dog&fields=id,title,longText'
    })
    equal(res.statusCode, 200, 'GET /posts?where.title.eq=Dog status code')
    same(res.json(), [{
      id: '1',
      title: 'Dog',
      longText: 'Foo'
    }], 'GET /posts?where.title.eq=Dog response')
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: '/posts?where.title.neq=Dog&fields=id,title,longText'
    })
    equal(res.statusCode, 200, 'GET /posts?where.title.neq=Dog status code')
    same(res.json(), [{
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
    }], 'GET /posts?where.title.neq=Dog response')
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: '/posts?where.counter.gt=10&fields=id,title,longText'
    })
    equal(res.statusCode, 200, 'GET /posts?where.counter.gt=10 status code')
    same(res.json(), [{
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
    }], 'GET /posts?where.counter.gt=10 response')
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: '/posts?where.counter.lt=40&fields=id,title,longText'
    })
    equal(res.statusCode, 200, 'GET /posts?where.counter.lt=40 status code')
    same(res.json(), [{
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
    }], 'GET /posts?where.counter.lt=40 response')
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: '/posts?where.counter.lte=30&fields=id,title,longText'
    })
    equal(res.statusCode, 200, 'GET /posts?where.counter.lte=30 posts status code')
    same(res.json(), [{
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
    }], 'GET /posts?where.counter.lte=30 response')
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: '/posts?where.counter.gte=20&fields=id,title,longText'
    })
    equal(res.statusCode, 200, 'GET /posts?where.counter.gte=20 status code')
    same(res.json(), [{
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
    }], 'GET /posts?where.counter.gte=20 response')
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: '/posts?where.counter.in=20,30&fields=id,title,longText'
    })
    equal(res.statusCode, 200, 'posts status code')
    same(res.json(), [{
      id: '2',
      title: 'Cat',
      longText: 'Bar'
    }, {
      id: '3',
      title: 'Mouse',
      longText: 'Baz'
    }], 'posts response')
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: '/posts?where.counter.nin=10,40&fields=id,title,longText'
    })
    equal(res.statusCode, 200, '/posts status code')
    same(res.json(), [{
      id: '2',
      title: 'Cat',
      longText: 'Bar'
    }, {
      id: '3',
      title: 'Mouse',
      longText: 'Baz'
    }], '/posts response')
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: '/posts?where.counter.gt=10&where.counter.lt=40&fields=id,title,longText'
    })
    equal(res.statusCode, 200, '/posts status code')
    same(res.json(), [{
      id: '2',
      title: 'Cat',
      longText: 'Bar'
    }, {
      id: '3',
      title: 'Mouse',
      longText: 'Baz'
    }], 'posts response')
  }

  {
    const res = await app.inject({
      method: 'GET',
      url: '/posts?where.title.in=Dog,Cat&fields=id,title,longText'
    })
    equal(res.statusCode, 200, 'GET /posts?where.title.in=Dog,Cat status code')
    same(res.json(), [{
      id: '1',
      title: 'Dog',
      longText: 'Foo'
    }, {
      id: '2',
      title: 'Cat',
      longText: 'Bar'
    }], 'GET /posts?where.title.in=Dog,Cat response')
  }

  // Skip unknown properties now
  {
    const res = await app.inject({
      method: 'GET',
      url: '/posts?where.foo.in=Dog,Cat&fields=id,title,longText'
    })
    equal(res.statusCode, 200, 'GET /posts?where.title.in=Dog,Cat status code')
    same(res.json(), [{
      id: '1',
      title: 'Dog',
      longText: 'Foo'
    }, {
      id: '2',
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
    }], 'GET /posts?where.title.in=Dog,Cat response')
  }
})
