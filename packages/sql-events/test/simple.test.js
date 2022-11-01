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
  equal(setupEmitter({ mapper, mq, log: fakeLogger }), undefined)
  const queue = await mapper.subscribe([
    '/entity/page/save/+',
    '/entity/page/delete/+'
  ])
  equal(mapper.mq, mq)

  const expected = []

  // save - new record
  const page = await pageEntity.save({
    input: { title: 'fourth page' }
  })
  expected.push({
    topic: '/entity/page/save/' + page.id,
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
    topic: '/entity/page/save/' + page.id,
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
    topic: '/entity/page/delete/' + page.id,
    payload: {
      id: page.id
    }
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
    '/entity/page/save/+',
    '/entity/page/delete/+'
  ])

  const expected = []

  // save - new record
  const page = await pageEntity.save({
    input: { title: 'fourth page' }
  })
  expected.push({
    topic: '/entity/page/save/' + page.id,
    payload: {
      id: page.id
    }
  })

  // save - update record
  await pageEntity.save({
    input: {
      id: page.id,
      title: 'fifth page'
    }
  })
  expected.push({
    topic: '/entity/page/save/' + page.id,
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
    topic: '/entity/page/delete/' + page.id,
    payload: {
      id: page.id
    }
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
  equal(setupEmitter({ mapper, mq, log: fakeLogger }), undefined)
  const queue = await mapper.subscribe('/entity/page/save/+')
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
      topic: '/entity/page/save/' + page.id,
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

test('more than one element for delete', async ({ equal, same, teardown }) => {
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
  equal(setupEmitter({ mapper, mq, log: fakeLogger }), undefined)
  const queue = await mapper.subscribe([
    '/entity/page/delete/+'
  ])
  equal(mapper.mq, mq)

  const expected = []

  const page1 = await pageEntity.save({
    input: { title: 'fourth page' }
  })

  const page2 = await pageEntity.save({
    input: { title: 'fifth page' }
  })

  // delete all pages
  await pageEntity.delete({
    where: {},
    fields: ['id', 'title']
  })

  expected.push({
    topic: '/entity/page/delete/' + page1.id,
    payload: {
      id: page1.id
    }
  })

  expected.push({
    topic: '/entity/page/delete/' + page2.id,
    payload: {
      id: page2.id
    }
  })

  for await (const ev of queue) {
    same(ev, expected.shift())
    if (expected.length === 0) {
      break
    }
  }
})
