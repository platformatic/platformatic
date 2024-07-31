'use strict'

const { clear, connInfo, isPg, isMysql, isSQLite } = require('./helper')
const { test, skip } = require('node:test')
const { deepEqual: same, equal, ok: pass } = require('node:assert')
const sqlGraphQL = require('..')
const sqlMapper = require('@platformatic/sql-mapper')
const fastify = require('fastify')

test('[PG] simple db simple graphql schema', { skip: !isPg }, async (t) => {
  const app = fastify()
  app.register(sqlMapper, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      pass('onDatabaseLoad called')

      await clear(db, sql)

      await db.query(sql`
      CREATE TYPE simple_enum as ENUM ('value1', 'value2');
      CREATE TABLE simple_types (
        id SERIAL8 PRIMARY KEY,
        published BOOL,
        current DOUBLE PRECISION,
        long_text TEXT,
        born_at_date DATE,
        born_at_time TIME,
        born_at_timetz TIME,
        born_at_timestamp TIMESTAMP,
        born_at_timestamptz TIMESTAMPTZ,
        uuid UUID UNIQUE,
        a_real real,
        a_smallint smallint,
        a_decimal decimal,
        an_enum simple_enum
      );`)
    },
  })
  t.after(() => app.close())

  app.register(sqlGraphQL)

  await app.ready()

  const timestamp = new Date()

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
          mutation {
            saveSimpleType(input: {
                              published: true,
                              current: 42,
                              longText: "abc",
                              bornAtDate: "2021-11-11",
                              bornAtTime: "12:42:00Z",
                              bornAtTimetz: "12:42:00Z",
                              bornAtTimestamp: "${timestamp.toISOString()}",
                              bornAtTimestamptz: "${timestamp.toISOString()}",
                              uuid: "12345678-1234-1234-1234-123456789012",
                              aReal: 1.2,
                              aSmallint: 42,
                              aDecimal: "42",
                              anEnum: value1
                            }) {
              id
              published
              current
              longText
              bornAtDate
              bornAtTime
              bornAtTimetz
              bornAtTimestamp
              bornAtTimestamptz
              uuid
              aReal
              aSmallint
              aDecimal
              anEnum
            }
          }
        `,
      },
    })
    equal(res.statusCode, 200, 'saveSimpleType status code')
    same(res.json(), {
      data: {
        saveSimpleType: {
          id: '1',
          published: true,
          current: 42,
          longText: 'abc',
          bornAtDate: '2021-11-11',
          bornAtTime: '12:42:00',
          bornAtTimetz: '12:42:00',
          bornAtTimestamp: timestamp.toISOString(),
          bornAtTimestamptz: timestamp.toISOString(),
          uuid: '12345678-1234-1234-1234-123456789012',
          aReal: 1.2,
          aSmallint: 42,
          aDecimal: '42',
          anEnum: 'value1',
        },
      },
    }, 'saveSimpleType response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
          query {
            getSimpleTypeById(id: 1) {
              id
              published
              current
              longText
              bornAtDate
              bornAtTime
              bornAtTimetz
              bornAtTimestamp
              bornAtTimestamptz
              uuid
              aReal
              aSmallint
              aDecimal
              anEnum
            }
          }
        `,
      },
    })
    equal(res.statusCode, 200, 'getSimpleTypeById status code')
    same(res.json(), {
      data: {
        getSimpleTypeById: {
          id: 1,
          published: true,
          current: 42,
          longText: 'abc',
          bornAtDate: '2021-11-11',
          bornAtTime: '12:42:00',
          bornAtTimetz: '12:42:00',
          bornAtTimestamp: timestamp.toISOString(),
          bornAtTimestamptz: timestamp.toISOString(),
          uuid: '12345678-1234-1234-1234-123456789012',
          aReal: 1.2,
          aSmallint: 42,
          aDecimal: 42,
          anEnum: 'value1',
        },
      },
    }, 'getSimpleTypeById response')
  }
})

test('[PG] - UUID', { skip: !isPg }, async (t) => {
  const app = fastify()
  app.register(sqlMapper, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      pass('onDatabaseLoad called')

      await clear(db, sql)

      await db.query(sql`
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
      CREATE TABLE pages (
        id uuid PRIMARY KEY default uuid_generate_v1(),
        title VARCHAR(42)
      );`)
    },
  })
  app.register(sqlGraphQL)
  t.after(() => app.close())

  await app.ready()

  let id
  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
          mutation {
            savePage(input: { title: "Hello" }) {
              id
              title
            }
          }
        `,
      },
    })
    equal(res.statusCode, 200, 'savePage status code')
    id = res.json().data.savePage.id
    same(res.json(), {
      data: {
        savePage: {
          id,
          title: 'Hello',
        },
      },
    }, 'savePage response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
          query {
            getPageById(id: "${id}") {
              id
              title
            }
          }
        `,
      },
    })
    equal(res.statusCode, 200, 'pages status code')
    same(res.json(), {
      data: {
        getPageById: {
          id,
          title: 'Hello',
        },
      },
    }, 'pages response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
          mutation {
            savePage(input: { id: "${id}", title: "Hello World" }) {
              id
              title
            }
          }
        `,
      },
    })
    equal(res.statusCode, 200, 'savePage status code')
    same(res.json(), {
      data: {
        savePage: {
          id,
          title: 'Hello World',
        },
      },
    }, 'savePage response')
  }
})

test('[MySQL] simple db simple graphql schema', { skip: !isMysql }, async (t) => {
  const app = fastify()
  app.register(sqlMapper, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      pass('onDatabaseLoad called')

      await clear(db, sql)

      const uuidType = db.isMariaDB ? sql.__dangerous__rawValue('uuid') : sql.__dangerous__rawValue('varchar(200)')

      await db.query(sql`CREATE TABLE simple_types (
        id SERIAL PRIMARY KEY,
        published BOOL,
        current DOUBLE PRECISION,
        long_text TEXT,
        born_at_date DATE,
        born_at_time TIME,
        born_at_timestamp TIMESTAMP,
        uuid ${uuidType} UNIQUE,
        a_real real,
        a_smallint smallint,
        a_decimal decimal,
        an_enum enum ('value1', 'value2')
      );`)
    },
  })
  app.register(sqlGraphQL)
  t.after(() => app.close())

  await app.ready()

  const timestamp = new Date()
  timestamp.setSeconds(0)
  timestamp.setMilliseconds(0)

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
          mutation {
            saveSimpleType(input: {
                              published: true,
                              current: 42,
                              longText: "abc",
                              bornAtDate: "2021-11-11",
                              bornAtTime: "12:42:00",
                              bornAtTimestamp: "${timestamp.toISOString()}",
                              uuid: "12345678-1234-1234-1234-123456789012",
                              aReal: 1.2,
                              aSmallint: 42,
                              aDecimal: "42",
                              anEnum: value1
                            }) {
              id
              published
              current
              longText
              bornAtDate
              bornAtTime
              bornAtTimestamp
              uuid
              aReal
              aSmallint
              aDecimal
              anEnum
            }
          }
        `,
      },
    })
    equal(res.statusCode, 200, 'saveSimpleType status code')
    same(res.json(), {
      data: {
        saveSimpleType: {
          id: '1',
          published: true,
          current: 42,
          longText: 'abc',
          bornAtDate: '2021-11-11',
          bornAtTime: '12:42:00',
          bornAtTimestamp: timestamp.toISOString(),
          uuid: '12345678-1234-1234-1234-123456789012',
          aReal: 1.2,
          aSmallint: 42,
          aDecimal: '42',
          anEnum: 'value1',
        },
      },
    }, 'saveSimpleType response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
          query {
            getSimpleTypeById(id: 1) {
              id
              published
              current
              longText
              bornAtDate
              bornAtTime
              bornAtTimestamp
              uuid
              aReal
              aSmallint
              aDecimal
              anEnum
            }
          }
        `,
      },
    })
    equal(res.statusCode, 200, 'getSimpleTypeById status code')
    same(res.json(), {
      data: {
        getSimpleTypeById: {
          id: 1,
          published: true,
          current: 42,
          longText: 'abc',
          bornAtDate: '2021-11-11',
          bornAtTime: '12:42:00',
          bornAtTimestamp: timestamp.toISOString(),
          uuid: '12345678-1234-1234-1234-123456789012',
          aReal: 1.2,
          aSmallint: 42,
          aDecimal: '42',
          anEnum: 'value1',
        },
      },
    }, 'getSimpleTypeById response')
  }
})

test('[MySQL] - UUID', { skip: !isMysql }, async (t) => {
  const app = fastify()
  app.register(sqlMapper, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      pass('onDatabaseLoad called')
      if (!db.isMariaDB) {
        return
      }

      await clear(db, sql)

      await db.query(sql`
      CREATE TABLE pages (
        id uuid PRIMARY KEY default UUID(),
        title VARCHAR(42)
      );`)
    },
  })
  app.register(sqlGraphQL)
  t.after(() => app.close())

  await app.ready()

  if (!app.platformatic.db.isMariaDB) {
    skip('MySQL does not support UUID, only MariaDB does')
    return
  }

  let id
  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
          mutation {
            savePage(input: { title: "Hello" }) {
              id
              title
            }
          }
        `,
      },
    })
    equal(res.statusCode, 200, 'savePage status code')
    id = res.json().data.savePage.id
    same(res.json(), {
      data: {
        savePage: {
          id,
          title: 'Hello',
        },
      },
    }, 'savePage response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
          query {
            getPageById(id: "${id}") {
              id
              title
            }
          }
        `,
      },
    })
    equal(res.statusCode, 200, 'pages status code')
    same(res.json(), {
      data: {
        getPageById: {
          id,
          title: 'Hello',
        },
      },
    }, 'pages response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
          mutation {
            savePage(input: { id: "${id}", title: "Hello World" }) {
              id
              title
            }
          }
        `,
      },
    })
    equal(res.statusCode, 200, 'savePage status code')
    same(res.json(), {
      data: {
        savePage: {
          id,
          title: 'Hello World',
        },
      },
    }, 'savePage response')
  }
})

test('[SQLite] simple db simple graphql schema', { skip: !isSQLite }, async (t) => {
  const app = fastify()
  app.register(sqlMapper, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      pass('onDatabaseLoad called')

      await clear(db, sql)

      await db.query(sql`CREATE TABLE simple_types (
        id INTEGER PRIMARY KEY,
        published BOOL,
        current DOUBLE PRECISION,
        long_text TEXT,
        born_at_timestamp TIMESTAMP,
        uuid UUID UNIQUE,
        a_real real,
        a_smallint smallint,
        a_decimal decimal
      );`)
    },
  })
  t.after(() => app.close())

  app.register(sqlGraphQL)

  await app.ready()

  const timestamp = new Date()

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
          mutation {
            saveSimpleType(input: {
                              published: true,
                              current: 42,
                              longText: "abc",
                              bornAtTimestamp: "${timestamp.toISOString()}",
                              uuid: "12345678-1234-1234-1234-123456789012",
                              aReal: 1.2,
                              aSmallint: 42,
                              aDecimal: "42" }) {
              id
              published
              current
              longText
              bornAtTimestamp
              uuid
              aReal
              aSmallint
              aDecimal
            }
          }
        `,
      },
    })
    equal(res.statusCode, 200, 'saveSimpleType status code')
    same(res.json(), {
      data: {
        saveSimpleType: {
          id: '1',
          published: true,
          current: 42,
          longText: 'abc',
          bornAtTimestamp: timestamp.toISOString(),
          uuid: '12345678-1234-1234-1234-123456789012',
          aReal: 1.2,
          aSmallint: 42,
          aDecimal: '42',
        },
      },
    }, 'saveSimpleType response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
          query {
            getSimpleTypeById(id: 1) {
              id
              published
              current
              longText
              bornAtTimestamp
              uuid
              aReal
              aSmallint
              aDecimal
            }
          }
        `,
      },
    })
    equal(res.statusCode, 200, 'getSimpleTypeById status code')
    same(res.json(), {
      data: {
        getSimpleTypeById: {
          id: 1,
          published: true,
          current: 42,
          longText: 'abc',
          bornAtTimestamp: timestamp.toISOString(),
          uuid: '12345678-1234-1234-1234-123456789012',
          aReal: 1.2,
          aSmallint: 42,
          aDecimal: '42',
        },
      },
    }, 'getSimpleTypeById response')
  }
})

test('[SQLite] - UUID', { skip: !isSQLite }, async (t) => {
  const app = fastify()
  app.register(sqlMapper, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      pass('onDatabaseLoad called')

      await clear(db, sql)

      await db.query(sql`
      CREATE TABLE pages (
        id uuid PRIMARY KEY,
        title VARCHAR(42)
      );`)
    },
  })
  app.register(sqlGraphQL)

  t.after(() => app.close())

  await app.ready()

  let id
  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
          mutation {
            savePage(input: { title: "Hello" }) {
              id
              title
            }
          }
        `,
      },
    })
    equal(res.statusCode, 200, 'savePage status code')
    id = res.json().data.savePage.id
    same(res.json(), {
      data: {
        savePage: {
          id,
          title: 'Hello',
        },
      },
    }, 'savePage response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
          query {
            getPageById(id: "${id}") {
              id
              title
            }
          }
        `,
      },
    })
    equal(res.statusCode, 200, 'pages status code')
    same(res.json(), {
      data: {
        getPageById: {
          id,
          title: 'Hello',
        },
      },
    }, 'pages response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
          mutation {
            savePage(input: { id: "${id}", title: "Hello World" }) {
              id
              title
            }
          }
        `,
      },
    })
    equal(res.statusCode, 200, 'savePage status code')
    same(res.json(), {
      data: {
        savePage: {
          id,
          title: 'Hello World',
        },
      },
    }, 'savePage response')
  }
})

test('BIGINT!', { skip: isSQLite }, async (t) => {
  const app = fastify()
  app.register(sqlMapper, {
    ...connInfo,
    async onDatabaseLoad (db, sql) {
      pass('onDatabaseLoad called')

      await clear(db, sql)

      await db.query(sql`
      CREATE TABLE simple_types (
        id SERIAL PRIMARY KEY,
        counter BIGINT
      );`)
    },
  })
  t.after(() => app.close())

  app.register(sqlGraphQL)

  await app.ready()

  const counter = BigInt(Number.MAX_SAFE_INTEGER) + 1000n

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
          mutation {
            saveSimpleType(input: {
                             counter: "${counter}"
                           }) {
              id
              counter
            }
          }
        `,
      },
    })
    equal(res.statusCode, 200, 'saveSimpleType status code')
    same(res.json(), {
      data: {
        saveSimpleType: {
          id: '1',
          counter,
        },
      },
    }, 'saveSimpleType response')
  }

  {
    const res = await app.inject({
      method: 'POST',
      url: '/graphql',
      body: {
        query: `
          query {
            getSimpleTypeById(id: 1) {
              id
              counter
            }
          }
        `,
      },
    })
    equal(res.statusCode, 200, 'getSimpleTypeById status code')
    same(res.json(), {
      data: {
        getSimpleTypeById: {
          id: 1,
          counter,
        },
      },
    }, 'getSimpleTypeById response')
  }
})
