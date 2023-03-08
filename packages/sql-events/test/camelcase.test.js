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

test('emit events when there is a primary key to be camelised', async ({ equal, same, teardown }) => {
  async function onDatabaseLoad (db, sql) {
    await clear(db, sql)
    teardown(() => db.dispose())

    if (isSQLite) {
      await db.query(sql`CREATE TABLE pages (
        page_id INTEGER PRIMARY KEY,
        title VARCHAR(42)
      );`)
    } else {
      await db.query(sql`CREATE TABLE pages (
        page_id SERIAL PRIMARY KEY,
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
    topic: '/entity/page/save/' + page.pageId,
    payload: {
      pageId: page.pageId
    }
  })

  // save - update record
  const page2 = await pageEntity.save({
    input: {
      pageId: page.pageId,
      title: 'fifth page'
    }
  })
  expected.push({
    topic: '/entity/page/save/' + page.pageId,
    payload: {
      pageId: page2.pageId
    }
  })

  await pageEntity.delete({
    where: {
      pageId: {
        eq: page.pageId
      }
    },
    fields: ['pageId', 'title']
  })

  expected.push({
    topic: '/entity/page/delete/' + page.pageId,
    payload: {
      pageId: page.pageId
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
        page_id INTEGER PRIMARY KEY,
        title VARCHAR(42)
      );`)
    } else {
      await db.query(sql`CREATE TABLE pages (
        page_id SERIAL PRIMARY KEY,
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
    topic: '/entity/page/save/' + page.pageId,
    payload: {
      pageId: page.pageId
    }
  })

  // save - update record
  await pageEntity.save({
    input: {
      pageId: page.pageId,
      title: 'fifth page'
    }
  })
  expected.push({
    topic: '/entity/page/save/' + page.pageId,
    payload: {
      pageId: page.pageId
    }
  })

  await pageEntity.delete({
    where: {
      pageId: {
        eq: page.pageId
      }
    }
  })

  expected.push({
    topic: '/entity/page/delete/' + page.pageId,
    payload: {
      pageId: page.pageId
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
        page_id INTEGER PRIMARY KEY,
        title VARCHAR(42)
      );`)
    } else {
      await db.query(sql`CREATE TABLE pages (
        page_id SERIAL PRIMARY KEY,
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
      topic: '/entity/page/save/' + page.pageId,
      payload: {
        pageId: page.pageId
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
        page_id INTEGER PRIMARY KEY,
        title VARCHAR(42)
      );`)
    } else {
      await db.query(sql`CREATE TABLE pages (
        page_id SERIAL PRIMARY KEY,
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
    fields: ['pageId', 'title']
  })

  expected.push({
    topic: '/entity/page/delete/' + page1.pageId,
    payload: {
      pageId: page1.pageId
    }
  })

  expected.push({
    topic: '/entity/page/delete/' + page2.pageId,
    payload: {
      pageId: page2.pageId
    }
  })

  for await (const ev of queue) {
    same(ev, expected.shift())
    if (expected.length === 0) {
      break
    }
  }
})
