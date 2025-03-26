'use strict'

const { test } = require('node:test')
const { equal, deepEqual } = require('node:assert')
const { connect } = require('..')
const { clear, connInfo, isSQLite } = require('./helper')

const fakeLogger = {
  trace: () => {},
  error: () => {},
  warn: () => {},
}

test('single field cursor pagination', async () => {
  const mapper = await connect({
    ...connInfo,
    log: fakeLogger,
    async onDatabaseLoad (db, sql) {
      test.after(async () => {
        await clear(db, sql)
        db.dispose()
      })
      await clear(db, sql)
      if (isSQLite) {
        await db.query(sql`CREATE TABLE articles (
          id INTEGER PRIMARY KEY,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
          title VARCHAR(100),
          content TEXT
        );`)
      } else {
        await db.query(sql`CREATE TABLE articles (
          id SERIAL PRIMARY KEY,
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          title VARCHAR(100),
          content TEXT
        );`)
      }
    },
  })

  const entity = mapper.entities.article
  const articles = [
    { title: 'First Article', content: 'Content 1', timestamp: '2025-01-01 10:00:00' },
    { title: 'Second Article', content: 'Content 2', timestamp: '2025-01-02 10:00:00' },
    { title: 'Third Article', content: 'Content 3', timestamp: '2025-01-03 10:00:00' },
    { title: 'Fourth Article', content: 'Content 4', timestamp: '2025-01-04 10:00:00' },
    { title: 'Fifth Article', content: 'Content 5', timestamp: '2025-01-05 10:00:00' },
    { title: 'Sixth Article', content: 'Content 6', timestamp: '2025-01-05 11:00:00' },
    { title: 'Seventh Article', content: 'Content 7', timestamp: '2025-01-05 12:00:00' },
    { title: 'Eighth Article', content: 'Content 8', timestamp: '2025-01-05 13:00:00' }
  ]
  await entity.insert({
    inputs: articles,
  })

  const firstPage = await entity.find({
    limit: 3,
    orderBy: [{ field: 'id', direction: 'asc' }],
    fields: ['id', 'title']
  })
  deepEqual(firstPage.map(p => p.id), ['1', '2', '3'], 'First page contains correct IDs')
  equal(firstPage.length, 3, 'First page has correct number of items')

  const cursor = { id: firstPage[firstPage.length - 1].id }
  const secondPage = await entity.find({
    limit: 3,
    cursor,
    orderBy: [{ field: 'id', direction: 'asc' }],
    fields: ['id', 'title']
  })

  deepEqual(secondPage.map(p => p.id), ['4', '5', '6'], 'Second page contains correct IDs')
  equal(secondPage.length, 3, 'Second page has correct number of items')
})
