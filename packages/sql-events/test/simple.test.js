'use strict'

const { test } = require('tap')
const { connect } = require('@platformatic/sql-mapper')
const { clear, connInfo, isSQLite, isMysql } = require('./helper')
const { setupEmitter } = require('..')
const MQEmitter = require('mqemitter')

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
    '/entity/page/create',
    '/entity/page/update/+',
    '/entity/page/delete/+'
  ])
  equal(mapper.mq, mq)

  const expected = []

  // save - new record
  const page = await pageEntity.save({
    input: { title: 'fourth page' },
  })
  expected.push({
    topic: '/entity/page/create',
    page
  })

  // save - update record
  const page2 = await pageEntity.save({
    input: {
      id: page.id,
      title: 'fifth page'
    }
  })
  expected.push({
    topic: '/entity/page/update/' + page.id,
    page: page2
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
    page: page2
  })

  for await (let ev of queue) {
    same(ev, expected.shift())
    if (expected.length === 0) {
      break
    }
  }
})
