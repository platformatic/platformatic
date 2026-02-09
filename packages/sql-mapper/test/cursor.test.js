import { deepEqual, equal, ifError } from 'node:assert'
import { test } from 'node:test'
import { connect } from '../index.js'
import {
  MissingOrderByClauseError,
  MissingOrderByFieldForCursorError,
  MissingUniqueFieldInCursorError,
  UnknownFieldError
} from '../lib/errors.js'
import { clear, connInfo, isSQLite } from './helper.js'

const fakeLogger = {
  trace: () => {},
  error: () => {},
  warn: () => {}
}

test('single field cursor pagination', async test => {
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
    }
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
    { title: 'Ninth Article', content: 'Content 9', timestamp: '2025-01-05 10:00:00' }
  ]
  await entity.insert({
    inputs: articles
  })

  const firstPage = await entity.find({
    limit: 3,
    orderBy: [{ field: 'id', direction: 'asc' }]
  })
  deepEqual(
    firstPage.map(p => p.id),
    ['1', '2', '3'],
    'First page contains correct IDs'
  )

  const secondPage = await entity.find({
    limit: 3,
    cursor: { id: firstPage.at(-1).id },
    orderBy: [{ field: 'id', direction: 'asc' }]
  })
  deepEqual(
    secondPage.map(p => p.id),
    ['4', '5', '6'],
    'Second page contains correct IDs'
  )

  const secondPageWithOffset = await entity.find({
    limit: 3,
    offset: 1,
    cursor: { id: firstPage.at(-1).id },
    orderBy: [{ field: 'id', direction: 'asc' }]
  })
  deepEqual(
    secondPageWithOffset.map(p => p.id),
    ['5', '6', '7'],
    'Page with offset contains correct IDs'
  )

  // not all orderBy fields have to be in cursor (but all cursor fields must be in orderBy)
  const oppositePage = await entity.find({
    limit: 3,
    cursor: { id: secondPage.at(-1).id },
    orderBy: [
      { field: 'timestamp', direction: 'desc' },
      { field: 'id', direction: 'asc' }
    ]
  })
  deepEqual(
    oppositePage.map(p => p.id),
    ['7', '8', '9'],
    'Opposite timestamp page contains correct IDs'
  )

  const previousPage = await entity.find({
    limit: 3,
    nextPage: false,
    cursor: { id: oppositePage.at(0).id },
    orderBy: [{ field: 'id', direction: 'asc' }]
  })
  deepEqual(
    previousPage.map(p => p.id),
    ['4', '5', '6'],
    'Previous page contains correct IDs'
  )

  try {
    await entity.find({
      limit: 3,
      cursor: { id: firstPage.at(-1).id },
      orderBy: [{ field: 'timestamp', direction: 'asc' }]
    })
    ifError('Expected to throw when cursor field is not listed in orderBy')
  } catch (e) {
    equal(e.code, new MissingOrderByFieldForCursorError('id').code)
  }

  try {
    await entity.find({
      limit: 3,
      cursor: { unknown_field: firstPage.at(-1).id },
      orderBy: [{ field: 'id', direction: 'asc' }]
    })
    ifError('Expected to throw when unknown field provided in cursor')
  } catch (e) {
    equal(e.code, new UnknownFieldError('unknown_field').code)
  }

  try {
    await entity.find({
      limit: 3,
      cursor: { id: firstPage.at(-1).id }
    })
    ifError('Expected to throw when no orderBy')
  } catch (e) {
    equal(e.code, new MissingOrderByClauseError().code)
  }

  try {
    await entity.find({
      limit: 3,
      cursor: { timestamp: firstPage.at(-1).timestamp },
      orderBy: [{ field: 'timestamp', direction: 'asc' }]
    })
    ifError('Expected to throw when cursor does not contain unique field')
  } catch (e) {
    equal(e.code, new MissingUniqueFieldInCursorError().code)
  }
})

test('compound cursor: simple pagination', async test => {
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
    }
  })

  const entity = mapper.entities.article
  await entity.insert({
    inputs: [
      { title: 'First Article', content: 'Content 1', timestamp: '2025-01-01 10:00:00' },
      { title: 'Second Article', content: 'Content 2', timestamp: '2025-01-02 10:00:00' },
      { title: 'Third Article', content: 'Content 3', timestamp: '2025-01-02 11:00:00' },
      { title: 'Fourth Article', content: 'Content 4', timestamp: '2025-01-03 10:00:00' },
      { title: 'Fifth Article', content: 'Content 5', timestamp: '2025-01-03 11:00:00' },
      { title: 'Sixth Article', content: 'Content 6', timestamp: '2025-01-03 12:00:00' }
    ]
  })

  const firstPage = await entity.find({
    limit: 3,
    orderBy: [
      { field: 'timestamp', direction: 'asc' },
      { field: 'id', direction: 'asc' }
    ]
  })
  deepEqual(
    firstPage.map(p => p.id),
    ['1', '2', '3'],
    'First page contains correct IDs'
  )

  const secondPage = await entity.find({
    limit: 3,
    cursor: { timestamp: firstPage.at(-1).timestamp, id: firstPage.at(-1).id },
    orderBy: [
      { field: 'timestamp', direction: 'asc' },
      { field: 'id', direction: 'asc' }
    ]
  })
  deepEqual(
    secondPage.map(p => p.id),
    ['4', '5', '6'],
    'Second page contains correct IDs'
  )

  try {
    await entity.find({
      limit: 3,
      cursor: { timestamp: firstPage.at(-1).timestamp, title: firstPage.at(-1).title },
      orderBy: [
        { field: 'timestamp', direction: 'asc' },
        { field: 'title', direction: 'asc' }
      ]
    })
    ifError('Expected to throw when cursor does not contain unique field')
  } catch (e) {
    equal(e.code, new MissingUniqueFieldInCursorError().code)
  }
})

test('compound cursor: several rows have same timestamp', async test => {
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
    }
  })

  const entity = mapper.entities.article
  const ts = '2025-01-05 13:00:00'
  const normalArticles = [
    { title: 'First Article', content: 'Content 1', timestamp: '2025-01-01 10:00:00' },
    { title: 'Second Article', content: 'Content 2', timestamp: '2025-01-02 10:00:00' },
    { title: 'Third Article', content: 'Content 3', timestamp: '2025-01-02 11:00:00' },
    { title: 'Fourth Article', content: 'Content 4', timestamp: '2025-01-03 10:00:00' },
    { title: 'Fifth Article', content: 'Content 5', timestamp: '2025-01-03 11:00:00' },
    { title: 'Sixth Article', content: 'Content 6', timestamp: '2025-01-03 12:00:00' }
  ]
  const sameTsArticles = [
    { title: 'Seventh Article', content: 'Content 7', timestamp: ts },
    { title: 'Eighth Article', content: 'Content 8', timestamp: ts },
    { title: 'Ninth Article', content: 'Content 9', timestamp: ts }
  ]
  await entity.insert({
    inputs: [...normalArticles, ...sameTsArticles]
  })

  const firstTwoSameTs = await entity.find({
    limit: 2,
    where: { timestamp: { eq: ts } },
    orderBy: [
      { field: 'timestamp', direction: 'asc' },
      { field: 'id', direction: 'asc' }
    ]
  })

  const lastWithCursor = await entity.find({
    cursor: {
      id: firstTwoSameTs.at(-1).id,
      timestamp: firstTwoSameTs.at(-1).timestamp
    },
    orderBy: [
      { field: 'timestamp', direction: 'asc' },
      { field: 'id', direction: 'asc' }
    ]
  })

  deepEqual(
    lastWithCursor.map(p => p.id),
    ['9'],
    'Cursor pagination correctly follows tie-breaker order'
  )
})

test('compound cursor: backward pagination with same direction', async test => {
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
    }
  })

  const entity = mapper.entities.article
  await entity.insert({
    inputs: [
      { title: 'First Article', content: 'Content 1', timestamp: '2025-01-01 10:00:00' },
      { title: 'Second Article', content: 'Content 2', timestamp: '2025-01-02 10:00:00' },
      { title: 'Third Article', content: 'Content 3', timestamp: '2025-01-02 11:00:00' },
      { title: 'Fourth Article', content: 'Content 4', timestamp: '2025-01-03 10:00:00' },
      { title: 'Fifth Article', content: 'Content 5', timestamp: '2025-01-03 11:00:00' },
      { title: 'Sixth Article', content: 'Content 6', timestamp: '2025-01-03 12:00:00' }
    ]
  })

  const firstPage = await entity.find({
    limit: 3,
    orderBy: [
      { field: 'timestamp', direction: 'asc' },
      { field: 'id', direction: 'asc' }
    ]
  })
  const secondPage = await entity.find({
    limit: 3,
    cursor: { timestamp: firstPage.at(-1).timestamp, id: firstPage.at(-1).id },
    orderBy: [
      { field: 'timestamp', direction: 'asc' },
      { field: 'id', direction: 'asc' }
    ]
  })
  const previousPage = await entity.find({
    limit: 3,
    nextPage: false,
    cursor: { timestamp: secondPage.at(0).timestamp, id: secondPage.at(0).id },
    orderBy: [
      { field: 'timestamp', direction: 'asc' },
      { field: 'id', direction: 'asc' }
    ]
  })
  deepEqual(
    previousPage.map(p => p.id),
    ['1', '2', '3'],
    'Previous page contains correct IDs'
  )
})

test('compound cursor: mixed directions', async test => {
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
          rating INTEGER,
          title VARCHAR(100),
          content TEXT
        );`)
      } else {
        await db.query(sql`CREATE TABLE articles (
          id SERIAL PRIMARY KEY,
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          rating INTEGER,
          title VARCHAR(100),
          content TEXT
        );`)
      }
    }
  })

  const entity = mapper.entities.article
  await entity.insert({
    inputs: [
      { title: 'First', content: 'Content 1', timestamp: '2025-01-01 10:00:00', rating: 5 },
      { title: 'Second', content: 'Content 2', timestamp: '2025-01-01 10:00:00', rating: 4 },
      { title: 'Third', content: 'Content 3', timestamp: '2025-01-01 10:00:00', rating: 3 },
      { title: 'Fourth', content: 'Content 4', timestamp: '2025-01-02 10:00:00', rating: 5 },
      { title: 'Fifth', content: 'Content 5', timestamp: '2025-01-02 10:00:00', rating: 4 },
      { title: 'Sixth', content: 'Content 6', timestamp: '2025-01-02 10:00:00', rating: 3 }
    ]
  })

  // Mixed direction - timestamp ASC, rating DESC
  const firstPage = await entity.find({
    limit: 3,
    orderBy: [
      { field: 'timestamp', direction: 'asc' },
      { field: 'rating', direction: 'desc' }
    ]
  })
  // all rows have same ts
  deepEqual(
    firstPage.map(p => p.id),
    ['1', '2', '3'],
    'First page with mixed directions contains correct IDs'
  )

  const secondPage = await entity.find({
    limit: 3,
    cursor: { timestamp: firstPage.at(-1).timestamp, rating: firstPage.at(-1).rating, id: firstPage.at(-1).id },
    orderBy: [
      { field: 'timestamp', direction: 'asc' },
      { field: 'rating', direction: 'desc' },
      { field: 'id', direction: 'asc' }
    ]
  })
  deepEqual(
    secondPage.map(p => p.id),
    ['4', '5', '6'],
    'Second page with mixed directions contains correct IDs'
  )

  // Test backward pagination with mixed directions
  const previousPage = await entity.find({
    limit: 3,
    nextPage: false,
    cursor: { timestamp: secondPage.at(0).timestamp, rating: secondPage.at(0).rating, id: secondPage.at(0).id },
    orderBy: [
      { field: 'timestamp', direction: 'asc' },
      { field: 'rating', direction: 'desc' },
      { field: 'id', direction: 'asc' }
    ]
  })
  deepEqual(
    previousPage.map(p => p.id),
    ['1', '2', '3'],
    'Previous page with mixed directions contains correct IDs'
  )
})

test('compound cursor: four or more fields', async test => {
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
          category VARCHAR(100),
          rating INTEGER,
          title VARCHAR(100),
          content TEXT
        );`)
      } else {
        await db.query(sql`CREATE TABLE articles (
          id SERIAL PRIMARY KEY,
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          category VARCHAR(100),
          rating INTEGER,
          title VARCHAR(100),
          content TEXT
        );`)
      }
    }
  })

  const entity = mapper.entities.article
  await entity.insert({
    inputs: [
      { title: 'A1', content: 'Content 1', timestamp: '2025-01-01', category: 'tech', rating: 5 },
      { title: 'A2', content: 'Content 2', timestamp: '2025-01-01', category: 'tech', rating: 4 },
      { title: 'A3', content: 'Content 3', timestamp: '2025-01-01', category: 'food', rating: 5 },
      { title: 'A4', content: 'Content 4', timestamp: '2025-01-01', category: 'food', rating: 4 },
      { title: 'A5', content: 'Content 5', timestamp: '2025-01-02', category: 'tech', rating: 5 },
      { title: 'A6', content: 'Content 6', timestamp: '2025-01-02', category: 'tech', rating: 4 },
      { title: 'A7', content: 'Content 7', timestamp: '2025-01-02', category: 'food', rating: 5 },
      { title: 'A8', content: 'Content 8', timestamp: '2025-01-02', category: 'food', rating: 4 }
    ]
  })

  // 4, 3, 2, 1, 8, 7, 6, 5
  const orderBy = [
    { field: 'timestamp', direction: 'asc' },
    { field: 'category', direction: 'ASC' },
    { field: 'rating', direction: 'asc' },
    { field: 'id', direction: 'ASC' }
  ]

  const firstPage = await entity.find({
    limit: 3,
    orderBy
  })
  deepEqual(
    firstPage.map(p => p.id),
    ['4', '3', '2'],
    'First page contains correct IDs'
  )

  const secondPage = await entity.find({
    limit: 3,
    cursor: {
      timestamp: firstPage.at(-1).timestamp,
      category: firstPage.at(-1).category,
      rating: firstPage.at(-1).rating,
      id: firstPage.at(-1).id
    },
    orderBy
  })
  deepEqual(
    secondPage.map(p => p.id),
    ['1', '8', '7'],
    'Second page with three fields contains correct IDs'
  )

  const previousPage = await entity.find({
    limit: 3,
    nextPage: false,
    cursor: {
      timestamp: secondPage.at(0).timestamp,
      category: secondPage.at(0).category,
      rating: secondPage.at(0).rating,
      id: secondPage.at(0).id
    },
    orderBy
  })
  deepEqual(
    previousPage.map(p => p.id),
    ['4', '3', '2'],
    'Previous page with three fields contains correct IDs'
  )
})

test('compound cursor: where clause', async test => {
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
          category VARCHAR(100),
          rating INTEGER,
          title VARCHAR(100),
          content TEXT
        );`)
      } else {
        await db.query(sql`CREATE TABLE articles (
          id SERIAL PRIMARY KEY,
          timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          category VARCHAR(100),
          rating INTEGER,
          title VARCHAR(100),
          content TEXT
        );`)
      }
    }
  })

  const entity = mapper.entities.article
  await entity.insert({
    inputs: [
      { title: 'A1', content: 'Content 1', timestamp: '2025-01-01', category: 'tech', rating: 5 },
      { title: 'A2', content: 'Content 2', timestamp: '2025-01-01', category: 'tech', rating: 4 },
      { title: 'A3', content: 'Content 3', timestamp: '2025-01-01', category: 'food', rating: 5 },
      { title: 'A4', content: 'Content 4', timestamp: '2025-01-01', category: 'food', rating: 4 },
      { title: 'A5', content: 'Content 5', timestamp: '2025-01-02', category: 'tech', rating: 5 },
      { title: 'A6', content: 'Content 6', timestamp: '2025-01-02', category: 'tech', rating: 4 },
      { title: 'A7', content: 'Content 7', timestamp: '2025-01-02', category: 'food', rating: 5 },
      { title: 'A8', content: 'Content 8', timestamp: '2025-01-02', category: 'food', rating: 4 }
    ]
  })

  const orderBy = [
    { field: 'timestamp', direction: 'asc' },
    { field: 'rating', direction: 'asc' },
    { field: 'id', direction: 'ASC' }
  ]
  const where = {
    category: { eq: 'food' }
  }

  // 4, 3, 8, 7
  const firstPage = await entity.find({
    limit: 2,
    orderBy,
    where
  })
  deepEqual(
    firstPage.map(p => p.id),
    ['4', '3'],
    'First page contains correct IDs'
  )

  const secondPage = await entity.find({
    limit: 2,
    cursor: {
      timestamp: firstPage.at(-1).timestamp,
      rating: firstPage.at(-1).rating,
      id: firstPage.at(-1).id
    },
    orderBy,
    where
  })
  deepEqual(
    secondPage.map(p => p.id),
    ['8', '7'],
    'Second page with three fields contains correct IDs'
  )

  const previousPage = await entity.find({
    limit: 2,
    nextPage: false,
    cursor: {
      timestamp: secondPage.at(0).timestamp,
      rating: secondPage.at(0).rating,
      id: secondPage.at(0).id
    },
    orderBy,
    where
  })
  deepEqual(
    previousPage.map(p => p.id),
    ['4', '3'],
    'Previous page with three fields contains correct IDs'
  )
})
