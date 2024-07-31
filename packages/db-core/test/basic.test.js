'use strict'

const { test } = require('node:test')
const { deepEqual: same, equal, ok } = require('node:assert')
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

test('entities are available', async (t) => {
  const app = Fastify({
    pluginTimeout: 30000,
  })
  app.register(core, {
    ...connInfo,
    onDatabaseLoad,
  })
  t.after(() => app.close())

  await app.ready()
  ok(app.platformatic.entities.page)
})

test('graphql is available', async (t) => {
  const app = Fastify({
    pluginTimeout: 30000,
  })
  app.register(core, {
    ...connInfo,
    onDatabaseLoad,
  })
  t.after(() => app.close())

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
  same(res.json(), {
    data: {
      savePage: {
        id: 1,
        title: 'Hello',
      },
    },
  }, 'savePage response')
})

test('graphql is available via the boolean enabled flag', async (t) => {
  const app = Fastify({
    pluginTimeout: 30000,
  })
  app.register(core, {
    ...connInfo,
    onDatabaseLoad,
    graphql: {
      enabled: true,
    },
  })
  t.after(() => app.close())

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
  same(res.json(), {
    data: {
      savePage: {
        id: 1,
        title: 'Hello',
      },
    },
  }, 'savePage response')
})

test('graphql is available via the string enabled flag', async (t) => {
  const app = Fastify({
    pluginTimeout: 30000,
  })
  app.register(core, {
    ...connInfo,
    onDatabaseLoad,
    graphql: {
      enabled: 'true',
    },
  })
  t.after(() => app.close())

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
  same(res.json(), {
    data: {
      savePage: {
        id: 1,
        title: 'Hello',
      },
    },
  }, 'savePage response')
})

test('graphiql can be enabled', async (t) => {
  const app = Fastify({
    pluginTimeout: 30000,
  })
  app.register(core, {
    ...connInfo,
    onDatabaseLoad,
    graphql: {
      graphiql: true,
    },
  })
  t.after(() => app.close())

  const res = await app.inject({
    method: 'GET',
    url: '/graphiql',
  })
  equal(res.statusCode, 200, 'savePage status code')
})

test('graphql can be disabled', async (t) => {
  const app = Fastify({
    pluginTimeout: 30000,
  })
  app.register(core, {
    ...connInfo,
    onDatabaseLoad,
    graphql: false,
  })
  t.after(() => app.close())

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
  equal(res.statusCode, 404, '/graphql not found')
})

test('graphql can be disabled via boolean enabled flag', async (t) => {
  const app = Fastify({
    pluginTimeout: 30000,
  })
  app.register(core, {
    ...connInfo,
    onDatabaseLoad,
    graphql: {
      enabled: false,
    },
  })
  t.after(() => app.close())

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
  equal(res.statusCode, 404, '/graphql not found')
})

test('graphql can be disabled via string enabled flag', async (t) => {
  const app = Fastify({
    pluginTimeout: 30000,
  })
  app.register(core, {
    ...connInfo,
    onDatabaseLoad,
    graphql: {
      enabled: 'false',
    },
  })
  t.after(() => app.close())

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
  equal(res.statusCode, 404, '/graphql not found')
})

test('openapi is available', async (t) => {
  const app = Fastify({
    pluginTimeout: 30000,
  })
  app.register(core, {
    ...connInfo,
    onDatabaseLoad,
  })
  t.after(() => app.close())

  const res = await app.inject({
    method: 'GET',
    url: '/pages',
  })
  equal(res.statusCode, 200, '/pages status code')
})

test('openapi is available via the enabled flag', async (t) => {
  const app = Fastify({
    pluginTimeout: 30000,
  })
  app.register(core, {
    ...connInfo,
    onDatabaseLoad,
    openapi: {
      enabled: true,
    },
  })
  t.after(() => app.close())

  const res = await app.inject({
    method: 'GET',
    url: '/pages',
  })
  equal(res.statusCode, 200, '/pages status code')
})

test('openapi can be disabled', async (t) => {
  const app = Fastify({
    pluginTimeout: 30000,
  })
  app.register(core, {
    ...connInfo,
    onDatabaseLoad,
    openapi: false,
  })
  t.after(() => app.close())

  const res = await app.inject({
    method: 'GET',
    url: '/pages',
  })
  equal(res.statusCode, 404, '/pages status code')
})

test('openapi can be disabled via enabled flag', async (t) => {
  const app = Fastify({
    pluginTimeout: 30000,
  })
  app.register(core, {
    ...connInfo,
    onDatabaseLoad,
    openapi: {
      enabled: false,
    },
  })
  t.after(() => app.close())

  const res = await app.inject({
    method: 'GET',
    url: '/pages',
  })
  equal(res.statusCode, 404, '/pages status code')
})

test('openapi with an object', async (t) => {
  const app = Fastify({
    pluginTimeout: 30000,
  })
  app.register(core, {
    ...connInfo,
    onDatabaseLoad,
    openapi: {},
  })
  t.after(() => app.close())

  const res = await app.inject({
    method: 'GET',
    url: '/pages',
  })
  equal(res.statusCode, 200, '/pages status code')
})

test('mq is available', async (t) => {
  const app = Fastify({
    pluginTimeout: 30000,
  })
  await app.register(core, {
    ...connInfo,
    events: true,
    onDatabaseLoad,
  })
  t.after(() => app.close())

  const queue = await app.platformatic.subscribe([
    await app.platformatic.entities.page.getSubscriptionTopic({ action: 'save' }),
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
        `,
    },
  })
  equal(res.statusCode, 200, 'savePage status code')
  same(res.json(), {
    data: {
      savePage: {
        id: 1,
        title: 'Hello',
      },
    },
  }, 'savePage response')

  const [ev] = await once(queue, 'data')
  same(ev, {
    topic: '/entity/page/save/1',
    payload: {
      id: 1,
    },
  })
})

test('mq is available via the enabled flag', async (t) => {
  const app = Fastify({
    pluginTimeout: 30000,
  })
  await app.register(core, {
    ...connInfo,
    events: {
      enabled: true,
    },
    onDatabaseLoad,
  })
  t.after(() => app.close())

  const queue = await app.platformatic.subscribe([
    await app.platformatic.entities.page.getSubscriptionTopic({ action: 'save' }),
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
        `,
    },
  })
  equal(res.statusCode, 200, 'savePage status code')
  same(res.json(), {
    data: {
      savePage: {
        id: 1,
        title: 'Hello',
      },
    },
  }, 'savePage response')

  const [ev] = await once(queue, 'data')
  same(ev, {
    topic: '/entity/page/save/1',
    payload: {
      id: 1,
    },
  })
})

test('mq is disabled via the enabled flag', async (t) => {
  const app = Fastify({
    pluginTimeout: 30000,
  })
  await app.register(core, {
    ...connInfo,
    events: {
      enabled: false,
    },
    onDatabaseLoad,
  })
  t.after(() => app.close())

  same(app.platformatic.entities.page.getSubscriptionTopic, undefined, 'subscription not available')
})
