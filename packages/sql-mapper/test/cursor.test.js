'use strict'

const { test } = require('node:test')
const { equal, deepEqual, ifError } = require('node:assert')
const { connect } = require('..')
const { clear, connInfo, isSQLite } = require('./helper')
const errors = require('../lib/errors')

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
    { title: 'Sixth Article', content: 'Content 6', timestamp: '2025-01-05 13:00:00' },
    { title: 'Seventh Article', content: 'Content 7', timestamp: '2025-01-05 12:00:00' },
    { title: 'Eighth Article', content: 'Content 8', timestamp: '2025-01-05 11:00:00' },
    { title: 'Ninth Article', content: 'Content 9', timestamp: '2025-01-05 10:00:00' },
  ]
  await entity.insert({
    inputs: articles,
  })

  const firstPage = await entity.find({
    limit: 3,
    orderBy: [{ field: 'id', direction: 'asc' }],
  })
  deepEqual(firstPage.map(p => p.id), ['1', '2', '3'], 'First page contains correct IDs')

  const secondPage = await entity.find({
    limit: 3,
    cursor: { id: firstPage.at(-1).id },
    orderBy: [{ field: 'id', direction: 'asc' }]
  })
  deepEqual(secondPage.map(p => p.id), ['4', '5', '6'], 'Second page contains correct IDs')

  const secondPageWithOffset = await entity.find({
    limit: 3,
    offset: 1,
    cursor: { id: firstPage.at(-1).id },
    orderBy: [{ field: 'id', direction: 'asc' }]
  })
  deepEqual(secondPageWithOffset.map(p => p.id), ['5', '6', '7'], 'Page with offset contains correct IDs')

  // not all orderBy fields have to be in cursor (but all cursor fields must be in orderBy)
  const oppositePage = await entity.find({
    limit: 3,
    cursor: { id: secondPage.at(-1).id },
    orderBy: [{ field: 'timestamp', direction: 'desc' }, { field: 'id', direction: 'asc' }]
  })
  deepEqual(oppositePage.map(p => p.id), ['7', '8', '9'], 'Opposite timestamp page contains correct IDs')

  const previousPage = await entity.find({
    limit: 3,
    nextPage: false,
    cursor: { id: oppositePage.at(0).id },
    orderBy: [{ field: 'id', direction: 'asc' }]
  })
  deepEqual(previousPage.map(p => p.id), ['4', '5', '6'], 'Previous page contains correct IDs')

  try {
    await entity.find({
      limit: 3,
      cursor: { id: firstPage.at(-1).id },
      orderBy: [{ field: 'timestamp', direction: 'asc' }]
    })
    ifError('Expected to throw when cursor field is not listed in orderBy')
  } catch (e) {
    equal(e.code, new errors.MissingOrderByFieldForCursorError('id').code)
  }

  try {
    await entity.find({
      limit: 3,
      cursor: { unknown_field: firstPage.at(-1).id },
      orderBy: [{ field: 'id', direction: 'asc' }]
    })
    ifError('Expected to throw when unknown field provided in cursor')
  } catch (e) {
    equal(e.code, new errors.UnknownFieldError('unknown_field').code)
  }

  try {
    await entity.find({
      limit: 3,
      cursor: { id: firstPage.at(-1).id },
    })
    ifError('Expected to throw when no orderBy')
  } catch (e) {
    equal(e.code, new errors.MissingOrderByClauseError().code)
  }

  try {
    await entity.find({
      limit: 3,
      cursor: { timestamp: firstPage.at(-1).timestamp },
      orderBy: [{ field: 'timestamp', direction: 'asc' }]
    })
    ifError('Expected to throw when cursor does not contain unique field')
  } catch (e) {
    equal(e.code, new errors.MissingUniqueFieldInCursorError().code)
  }
})

test('multiple field cursor pagination', async () => {
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
  await entity.insert({
    inputs: [
      { title: 'First Article', content: 'Content 1', timestamp: '2025-01-01 10:00:00' },
      { title: 'Second Article', content: 'Content 2', timestamp: '2025-01-02 10:00:00' },
      { title: 'Third Article', content: 'Content 3', timestamp: '2025-01-02 11:00:00' },
      { title: 'Fourth Article', content: 'Content 4', timestamp: '2025-01-03 10:00:00' },
      { title: 'Fifth Article', content: 'Content 5', timestamp: '2025-01-03 11:00:00' },
      { title: 'Sixth Article', content: 'Content 6', timestamp: '2025-01-03 12:00:00' },
      { title: 'Seventh Article', content: 'Content 7', timestamp: '2025-01-04 13:00:00' },
      { title: 'Eighth Article', content: 'Content 8', timestamp: '2025-01-04 13:00:00' },
      { title: 'Ninth Article', content: 'Content 9', timestamp: '2025-01-04 13:00:00' },
    ],
  })

  const firstPage = await entity.find({
    limit: 3,
    orderBy: [{ field: 'timestamp', direction: 'asc' }, { field: 'id', direction: 'asc' }],
  })
  deepEqual(firstPage.map(p => p.id), ['1', '2', '3'], 'First page contains correct IDs')

  const secondPage = await entity.find({
    limit: 3,
    cursor: { timestamp: firstPage.at(-1).timestamp, id: firstPage.at(-1).id },
    orderBy: [{ field: 'timestamp', direction: 'asc' }, { field: 'id', direction: 'asc' }]
  })
  deepEqual(secondPage.map(p => p.id), ['4', '5', '6'], 'Second page contains correct IDs')

  // todo(shcube): previous page compound case
})

test('articles with same timestamp are correctly ordered by id', async () => {
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
  const ts = '2025-01-05 13:00:00'
  const normalArticles = [
    { title: 'First Article', content: 'Content 1', timestamp: '2025-01-01 10:00:00' },
    { title: 'Second Article', content: 'Content 2', timestamp: '2025-01-02 10:00:00' },
    { title: 'Third Article', content: 'Content 3', timestamp: '2025-01-02 11:00:00' },
    { title: 'Fourth Article', content: 'Content 4', timestamp: '2025-01-03 10:00:00' },
    { title: 'Fifth Article', content: 'Content 5', timestamp: '2025-01-03 11:00:00' },
    { title: 'Sixth Article', content: 'Content 6', timestamp: '2025-01-03 12:00:00' },
  ]
  const sameTsArticles = [
    { title: 'Seventh Article', content: 'Content 7', timestamp: ts },
    { title: 'Eighth Article', content: 'Content 8', timestamp: ts },
    { title: 'Ninth Article', content: 'Content 9', timestamp: ts },
  ]
  await entity.insert({
    inputs: [
      ...normalArticles,
      ...sameTsArticles
    ],
  })

  const firstTwoSameTs = await entity.find({
    limit: 2,
    where: { timestamp: { eq: ts } },
    orderBy: [{ field: 'timestamp', direction: 'asc' }, { field: 'id', direction: 'asc' }],
  })

  const lastWithCursor = await entity.find({
    cursor: {
      id: firstTwoSameTs.at(-1).id,
      timestamp: firstTwoSameTs.at(-1).timestamp,
    },
    orderBy: [{ field: 'timestamp', direction: 'asc' }, { field: 'id', direction: 'asc' }],
  })

  deepEqual(lastWithCursor.map(p => p.id), ['9'], 'Cursor pagination correctly follows tie-breaker order')
})
