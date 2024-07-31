'use strict'

const { test } = require('node:test')
const { equal, deepEqual: same } = require('node:assert')
const sqlMapper = require('@platformatic/sql-mapper')
const { connect } = sqlMapper
const { clear, connInfo, isSQLite } = require('./helper')
const sqlEvents = require('..')
const { setupEmitter } = sqlEvents
const MQEmitterRedis = require('mqemitter-redis')
const { promisify } = require('util')
const { PassThrough } = require('stream')

const fakeLogger = {
  trace () {},
  error () {},
}

test('emit events', async (t) => {
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
    onDatabaseLoad,
  })
  const pageEntity = mapper.entities.page

  equal(setupEmitter({ mapper, connectionString: 'redis://127.0.0.1:6379', log: fakeLogger }), undefined)
  t.after(() => mapper.mq.close())

  const anotherMQ = new MQEmitterRedis()
  t.after(() => anotherMQ.close())

  const messages = new PassThrough({ objectMode: true })
  await promisify(anotherMQ.on.bind(anotherMQ))('#', function (msg, cb) {
    messages.write(msg, cb)
  })

  const queue = await mapper.subscribe([
    '/entity/page/save/+',
    '/entity/page/delete/+',
  ])

  const expected = []

  // save - new record
  const page = await pageEntity.save({
    input: { title: 'fourth page' },
  })
  expected.push({
    topic: '/entity/page/save/' + page.id,
    payload: {
      id: page.id,
    },
  })

  // save - update record
  await pageEntity.save({
    input: {
      id: page.id,
      title: 'fifth page',
    },
  })
  expected.push({
    topic: '/entity/page/save/' + page.id,
    payload: {
      id: page.id,
    },
  })

  await pageEntity.delete({
    where: {
      id: {
        eq: page.id,
      },
    },
    fields: ['id', 'title'],
  })

  expected.push({
    topic: '/entity/page/delete/' + page.id,
    payload: {
      id: page.id,
    },
  })

  let i = 0
  for await (const ev of queue) {
    same(ev, expected[i++])
    if (i === expected.length) {
      break
    }
  }

  i = 0
  for await (const ev of messages) {
    same(ev, expected[i++])
    if (i === expected.length) {
      break
    }
  }
})
