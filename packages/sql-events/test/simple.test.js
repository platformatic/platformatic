'use strict'

const { test } = require('tap')
const sqlMapper = require('@platformatic/sql-mapper')
const { connect } = sqlMapper
const { clear, connInfo, isSQLite } = require('./helper')
const sqlEvents = require('..')
const { setupEmitter } = sqlEvents
const MQEmitter = require('mqemitter')
const fastify = require('fastify')

const fakeLogger = {
  trace () {},
  error () {}
}

test('emit events', async ({ equal, same, teardown }) => {
  async function onDatabaseLoad (db, sql) {
    await clear(db, sql)
    teardown(() => db.dispose())

    if (isSQLite) {
      await db.query(sql`CREATE TABLE pages (
        id INTEGER PRIMARY KEY,
        title VARCHAR(42)
      );`)
    } else {
      await db.query(sql`CREATE TABLE pages (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL
      );`)
    }
  }
  const mapper = await connect({
    log: fakeLogger,
    ...connInfo,
    onDatabaseLoad
  })
  const pageEntity = mapper.entities.page

  const mq = MQEmitter()
  equal(setupEmitter({ mapper, mq }), undefined)
  const queue = await mapper.subscribe([
    '/entity/page/created',
    '/entity/page/updated/+',
    '/entity/page/deleted/+'
  ])
  equal(mapper.mq, mq)

  const expected = []

  // save - new record
  const page = await pageEntity.save({
    input: { title: 'fourth page' }
  })
  expected.push({
    topic: '/entity/page/created',
    payload: {
      id: page.id
    }
  })

  // save - update record
  const page2 = await pageEntity.save({
    input: {
      id: page.id,
      title: 'fifth page'
    }
  })
  expected.push({
    topic: '/entity/page/updated/' + page.id,
    payload: {
      id: page2.id
    }
  })

  await pageEntity.delete({
    where: {
      id: {
        eq: page.id
      }
    },
    fields: ['id', 'title']
  })

  expected.push({
    topic: '/entity/page/deleted/' + page.id,
    payload: page2
  })

  for await (const ev of queue) {
    same(ev, expected.shift())
    if (expected.length === 0) {
      break
    }
  }
})

test('return entities', async ({ pass, teardown, equal, same }) => {
  async function onDatabaseLoad (db, sql) {
    await clear(db, sql)

    if (isSQLite) {
      await db.query(sql`CREATE TABLE pages (
        id INTEGER PRIMARY KEY,
        title VARCHAR(42)
      );`)
    } else {
      await db.query(sql`CREATE TABLE pages (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL
      );`)
    }
  }
  const app = fastify()
  teardown(() => app.close())
  app.register(sqlMapper, {
    connectionString: connInfo.connectionString,
    onDatabaseLoad
  })
  app.register(sqlEvents)

  await app.ready()
  const pageEntity = app.platformatic.entities.page
  const queue = await app.platformatic.subscribe([
    '/entity/page/created',
    '/entity/page/updated/+',
    '/entity/page/deleted/+'
  ])

  const expected = []

  // save - new record
  const page = await pageEntity.save({
    input: { title: 'fourth page' }
  })
  expected.push({
    topic: '/entity/page/created',
    payload: {
      id: page.id
    }
  })

  // save - update record
  const page2 = await pageEntity.save({
    input: {
      id: page.id,
      title: 'fifth page'
    }
  })
  expected.push({
    topic: '/entity/page/updated/' + page.id,
    payload: {
      id: page.id
    }
  })

  await pageEntity.delete({
    where: {
      id: {
        eq: page.id
      }
    }
  })

  expected.push({
    topic: '/entity/page/deleted/' + page.id,
    payload: page2
  })

  for await (const ev of queue) {
    same(ev, expected.shift())
    if (expected.length === 0) {
      break
    }
  }
})

test('insert', async ({ equal, same, teardown }) => {
  async function onDatabaseLoad (db, sql) {
    await clear(db, sql)
    teardown(() => db.dispose())

    if (isSQLite) {
      await db.query(sql`CREATE TABLE pages (
        id INTEGER PRIMARY KEY,
        title VARCHAR(42)
      );`)
    } else {
      await db.query(sql`CREATE TABLE pages (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL
      );`)
    }
  }
  const mapper = await connect({
    log: fakeLogger,
    ...connInfo,
    onDatabaseLoad
  })
  const pageEntity = mapper.entities.page

  const mq = MQEmitter()
  equal(setupEmitter({ mapper, mq }), undefined)
  const queue = await mapper.subscribe('/entity/page/created')
  equal(mapper.mq, mq)

  const expected = []

  // save - new record
  const pages = await pageEntity.insert({
    inputs: [{
      title: 'fourth page'
    }, {
      title: 'fifth page'
    }]
  })

  for (const page of pages) {
    expected.push({
      topic: '/entity/page/created',
      payload: {
        id: page.id
      }
    })
  }

  for await (const ev of queue) {
    same(ev, expected.shift())
    if (expected.length === 0) {
      break
    }
  }
})
