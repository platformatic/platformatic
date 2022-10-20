'use strict'

const { test } = require('tap')
const Fastify = require('fastify')
const { clear, connInfo } = require('./helper')
const core = require('..')
const { once } = require('events')

async function createBasicPages (db, sql) {
  if (module.exports.isSQLite) {
    await db.query(sql`CREATE TABLE pages (
      id INTEGER PRIMARY KEY,
      title VARCHAR(42)
    );`)
  } else {
    await db.query(sql`CREATE TABLE pages (
      id SERIAL PRIMARY KEY,
      title VARCHAR(42)
    );`)
  }
}

async function onDatabaseLoad (db, sql) {
  await clear(db, sql)
  await createBasicPages(db, sql)
}

test('entities are available', async ({ ok, teardown }) => {
  const app = Fastify()
  app.register(core, {
    ...connInfo,
    onDatabaseLoad
  })
  teardown(() => app.close())

  await app.ready()
  ok(app.platformatic.entities.page)
})

test('graphql is available', async ({ equal, same, teardown }) => {
  const app = Fastify()
  app.register(core, {
    ...connInfo,
    onDatabaseLoad
  })
  teardown(() => app.close())

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
        `
    }
  })
  equal(res.statusCode, 200, 'savePage status code')
  same(res.json(), {
    data: {
      savePage: {
        id: 1,
        title: 'Hello'
      }
    }
  }, 'savePage response')
})

test('graphiql can be enabled', async ({ equal, same, teardown }) => {
  const app = Fastify()
  app.register(core, {
    ...connInfo,
    onDatabaseLoad,
    graphql: {
      graphiql: true
    }
  })
  teardown(() => app.close())

  const res = await app.inject({
    method: 'GET',
    url: '/graphiql'
  })
  equal(res.statusCode, 200, 'savePage status code')
})

test('graphql can be disabled', async ({ equal, teardown }) => {
  const app = Fastify()
  app.register(core, {
    ...connInfo,
    onDatabaseLoad,
    graphql: false
  })
  teardown(() => app.close())

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
        `
    }
  })
  equal(res.statusCode, 404, '/graphql not found')
})

test('openapi is available', async ({ equal, teardown }) => {
  const app = Fastify()
  app.register(core, {
    ...connInfo,
    onDatabaseLoad
  })
  teardown(() => app.close())

  const res = await app.inject({
    method: 'GET',
    url: '/pages'
  })
  equal(res.statusCode, 200, '/pages status code')
})

test('openapi can be disabled', async ({ equal, teardown }) => {
  const app = Fastify()
  app.register(core, {
    ...connInfo,
    onDatabaseLoad,
    openapi: false
  })
  teardown(() => app.close())

  const res = await app.inject({
    method: 'GET',
    url: '/pages'
  })
  equal(res.statusCode, 404, '/pages status code')
})

test('openapi with an object', async ({ equal, teardown }) => {
  const app = Fastify()
  app.register(core, {
    ...connInfo,
    onDatabaseLoad,
    openapi: {}
  })
  teardown(() => app.close())

  const res = await app.inject({
    method: 'GET',
    url: '/pages'
  })
  equal(res.statusCode, 200, '/pages status code')
})

test('mq is available', async ({ equal, same, teardown }) => {
  const app = Fastify()
  await app.register(core, {
    ...connInfo,
    events: true,
    onDatabaseLoad
  })
  teardown(() => app.close())

  const queue = await app.platformatic.subscribe([
    await app.platformatic.entities.page.getTopic({ action: 'create' }),
  ])

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
        `
    }
  })
  equal(res.statusCode, 200, 'savePage status code')
  same(res.json(), {
    data: {
      savePage: {
        id: 1,
        title: 'Hello'
      }
    }
  }, 'savePage response')

  const [ev] = await once(queue, 'data')
  same(ev, {
    topic: '/entity/page/created',
    payload: {
      id: 1
    }
  })
})
