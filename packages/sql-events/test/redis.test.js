'use strict'

const { test } = require('tap')
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
  error () {}
}

test('emit events', async ({ equal, same, teardown, comment }) => {
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

  equal(setupEmitter({ mapper, connectionString: 'redis://127.0.0.1:6379' }), undefined)
  teardown(promisify(mapper.mq.close.bind(mapper.mq)))

  const anotherMQ = new MQEmitterRedis()
  teardown(() => anotherMQ.close())

  const messages = new PassThrough({ objectMode: true })
  await promisify(anotherMQ.on.bind(anotherMQ))('#', function (msg, cb) {
    messages.write(msg, cb)
  })

  const queue = await mapper.subscribe([
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
