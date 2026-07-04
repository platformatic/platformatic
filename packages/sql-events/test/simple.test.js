import sqlMapper, { connect } from '@platformatic/sql-mapper'
import fastify from 'fastify'
import MQEmitter from 'mqemitter'
import { equal, deepEqual as same } from 'node:assert'
import { test } from 'node:test'
import sqlEvents, { setupEmitter } from '../index.js'
import { clear, connInfo, isSQLite } from './helper.js'

const fakeLogger = {
  trace () {},
  error () {}
}

test('emit events', async t => {
  async function onDatabaseLoad (db, sql) {
    await clear(db, sql)
    t.after(() => db.dispose())

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
  const queue = await mapper.subscribe(['/entity/page/save/+', '/entity/page/delete/+'])
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

test('return entities', async t => {
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
  t.after(() => app.close())
  app.register(sqlMapper, {
    connectionString: connInfo.connectionString,
    onDatabaseLoad
  })
  app.register(sqlEvents)

  await app.ready()
  const pageEntity = app.platformatic.entities.page
  const queue = await app.platformatic.subscribe(['/entity/page/save/+', '/entity/page/delete/+'])

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

test('insert', async t => {
  async function onDatabaseLoad (db, sql) {
    await clear(db, sql)
    t.after(() => db.dispose())

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
    inputs: [
      {
        title: 'fourth page'
      },
      {
        title: 'fifth page'
      }
    ]
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

test('more than one element for delete', async t => {
  async function onDatabaseLoad (db, sql) {
    await clear(db, sql)
    t.after(() => db.dispose())

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
  const queue = await mapper.subscribe(['/entity/page/delete/+'])
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

test('emit events when the primary key is not in the requested fields', async t => {
  /* https://github.com/platformatic/platformatic/issues/1805 */
  async function onDatabaseLoad (db, sql) {
    await clear(db, sql)
    t.after(() => db.dispose())

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
  const queue = await mapper.subscribe(['/entity/page/save/+', '/entity/page/delete/+'])

  const expected = []

  // save - new record, without the primary key in the fields
  const page = await pageEntity.save({
    input: { title: 'a page' },
    fields: ['title']
  })
  same(page, { title: 'a page' }, 'save returns only the requested fields')

  const [found] = await pageEntity.find({ fields: ['id'] })
  expected.push({
    topic: '/entity/page/save/' + found.id,
    payload: {
      id: found.id
    }
  })

  // insert - without the primary key in the fields
  const inserted = await pageEntity.insert({
    inputs: [{ title: 'another page' }],
    fields: ['title']
  })
  same(inserted, [{ title: 'another page' }], 'insert returns only the requested fields')

  const [found2] = await pageEntity.find({ fields: ['id'], orderBy: [{ field: 'id', direction: 'desc' }], limit: 1 })
  expected.push({
    topic: '/entity/page/save/' + found2.id,
    payload: {
      id: found2.id
    }
  })

  // delete - without the primary key in the fields
  const deleted = await pageEntity.delete({
    where: { id: { eq: found2.id } },
    fields: ['title']
  })
  same(deleted, [{ title: 'another page' }], 'delete returns only the requested fields')

  expected.push({
    topic: '/entity/page/delete/' + found2.id,
    payload: {
      id: found2.id
    }
  })

  for await (const ev of queue) {
    same(ev, expected.shift())
    if (expected.length === 0) {
      break
    }
  }
})
