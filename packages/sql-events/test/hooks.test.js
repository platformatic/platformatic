'use strict'

const { test } = require('tap')
const sqlMapper = require('@platformatic/sql-mapper')
const { connect } = sqlMapper
const { clear, connInfo, isSQLite } = require('./helper')
const sqlEvents = require('..')
const { setupEmitter } = sqlEvents
const MQEmitter = require('mqemitter')

const fakeLogger = {
  trace () {},
  error () {}
}

test('get topics', async ({ equal, same, teardown }) => {
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
    await pageEntity.getSubscriptionTopic({ action: 'save' }),
    await pageEntity.getSubscriptionTopic({ action: 'delete' })
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
    payload: page2
  })

  for await (const ev of queue) {
    same(ev, expected.shift())
    if (expected.length === 0) {
      break
    }
  }
})

test('hooks', async ({ equal, same, teardown }) => {
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
    await pageEntity.getSubscriptionTopic({ action: 'save' }),
    await pageEntity.getSubscriptionTopic({ action: 'delete' })
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
    payload: page2
  })

  for await (const ev of queue) {
    same(ev, expected.shift())
    if (expected.length === 0) {
      break
    }
  }
})

test('get topics', async ({ equal, same, teardown }) => {
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
  mapper.addEntityHooks('page', {
    async getSubscriptionTopic (original, { action }) {
      equal('create', action)
      return original({ action })
    }
  })

  const pageEntity = mapper.entities.page

  const mq = MQEmitter()
  equal(setupEmitter({ mapper, mq, log: fakeLogger }), undefined)
  await pageEntity.getSubscriptionTopic({ action: 'save' })
})

test('no events', async ({ equal, same, teardown, fail, comment }) => {
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

  const mq = MQEmitter()
  equal(setupEmitter({ mapper, mq, log: fakeLogger }), undefined)

  const pageEntity = mapper.entities.page

  // disable publishing
  pageEntity.getPublishTopic = function () {
    return false
  }

  const queue = await mapper.subscribe([
    await pageEntity.getSubscriptionTopic({ action: 'save' }),
    await pageEntity.getSubscriptionTopic({ action: 'delete' })
  ])
  equal(mapper.mq, mq)

  queue.on('data', function (msg) {
    comment(JSON.stringify(msg, null, 2))
    fail('no message')
  })

  // save - new record
  const page = await pageEntity.save({
    input: { title: 'fourth page' }
  })

  // save - update record
  await pageEntity.save({
    input: {
      id: page.id,
      title: 'fifth page'
    }
  })

  // delete a record
  await pageEntity.delete({
    where: {
      id: {
        eq: page.id
      }
    },
    fields: ['id', 'title']
  })
})

test('wrong action', async ({ equal, rejects, teardown, fail, comment }) => {
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

  setupEmitter({ mapper, log: fakeLogger })

  const pageEntity = mapper.entities.page

  equal(await pageEntity.getPublishTopic({ action: 'foo', data: { id: 42 } }), false)
  rejects(pageEntity.getPublishTopic({ action: 'foo', data: { } }))
  rejects(pageEntity.getPublishTopic({ action: 'foo' }))
  rejects(pageEntity.getSubscriptionTopic({ action: 'foo' }), 'no such action foo')
})
